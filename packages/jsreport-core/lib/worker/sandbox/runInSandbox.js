const LRU = require('lru-cache')
const safeSandbox = require('./safeSandbox')

module.exports = (reporter) => {
  const functionsCache = LRU({ max: 100 })

  return ({
    context,
    userCode,
    executionFn,
    onRequire,
    propertiesConfig
  }, req) => {
    const jsreportProxy = reporter.createProxy({ req })

    context.executionFn = executionFn
    context.__appDirectory = reporter.options.appDirectory
    context.__rootDirectory = reporter.options.rootDirectory
    context.__parentModuleDirectory = reporter.options.parentModuleDirectory
    context.setTimeout = setTimeout
    context.__handleError = handleError

    const { run, restore, sandbox } = safeSandbox(context, {
      onLog: (log) => {
        reporter.logger[log.level](log.message, { ...req, timestamp: log.timestamp })
      },
      formatError: (error, moduleName) => {
        error.message += ` To be able to require custom modules you need to add to configuration { "allowLocalFilesAccess": true } or enable just specific module using { sandbox: { allowedModules": ["${moduleName}"] }`
      },
      modulesCache: reporter.requestModulesCache.get(req.context.id),
      globalModules: reporter.options.sandbox.nativeModules || [],
      allowedModules: reporter.options.sandbox.allowedModules,
      propertiesConfig,
      requirePaths: [
        reporter.options.rootDirectory,
        reporter.options.appDirectory,
        reporter.options.parentModuleDirectory
      ],
      requireMap: (moduleName) => {
        const m = reporter.options.sandbox.modules.find((m) => m.alias === moduleName || m.path === moduleName)

        if (m) {
          return require(m.path)
        }

        if (moduleName === 'jsreport-proxy') {
          return jsreportProxy
        }

        if (onRequire) {
          return onRequire(moduleName, { context })
        }
      }
    })

    sandbox.__restore = restore

    const functionNames = getTopLevelFunctions(userCode, functionsCache)

    const functionsCode = `return {${functionNames.map(h => `"${h}": ${h}`).join(',')}}`
    const executionCode = `;(async () => { ${userCode}; ${functionsCode} })()
        .then((topLevelFunctions) => executionFn({ 
            topLevelFunctions,
            require,
            console,
            restore: __restore,
            context: this                   
        })).catch(__handleError);`

    return run(executionCode, {
      mainFilename: 'sandbox.js',
      filename: 'sandbox.js',
      mainSource: userCode
    })
  }
}

function handleError (errValue) {
  let newError

  const isErrorObj = (
    typeof errValue === 'object' &&
      typeof errValue.hasOwnProperty === 'function' &&
      Object.prototype.hasOwnProperty.call(errValue, 'message')
  )

  const isValidError = (
    isErrorObj ||
      typeof errValue === 'string'
  )

  if (!isValidError) {
    if (Object.prototype.toString.call(errValue) === '[object Object]') {
      newError = new Error(`User code threw with non-Error: ${JSON.stringify(errValue)}`)
    } else {
      newError = new Error(`User code threw with non-Error: ${errValue}`)
    }
  } else {
    if (typeof errValue === 'string') {
      newError = new Error(errValue)
    } else {
      newError = new Error(errValue.message)
      Object.assign(newError, errValue)
      if (errValue.stack) {
        newError.stack = errValue.stack
      }
    }
  }

  throw newError
}

function getTopLevelFunctions (code, cache) {
  const key = `functions:${code}`

  if (cache.has(key)) {
    return cache.get(key)
  }

  // lazy load to speed up boot
  const parser = require('@babel/parser')
  const traverse = require('@babel/traverse').default

  const names = []
  try {
    const ast = parser.parse(code, {
      sourceType: 'script',
      allowReturnOutsideFunction: false,
      allowAwaitOutsideFunction: true,
      plugins: [
        'classProperties',
        'classPrivateProperties',
        'classPrivateMethods',
        'doExpressions',
        'functionBind',
        'throwExpressions',
        'topLevelAwait'
      ]
    })

    // traverse only function declaration that are defined
    // at the top level of program
    traverse(ast, {
      FunctionDeclaration: (path) => {
        if (path.parent.type === 'Program') {
          names.push(path.node.id.name)
        }
      }
    })
  } catch (e) {
    // we let the error handling for later eval
    return []
  }

  cache.set(key, names)
  return names
}
