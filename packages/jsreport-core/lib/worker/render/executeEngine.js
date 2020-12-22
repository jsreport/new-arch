/*!
 * Copyright(c) 2018 Jan Blaha
 *
 * Child process script rendering html from template content, helpers and input data.
 * This script runs in the extra process because of multitenancy and security requirements, errors like infinite loop
 * should not affect other reports being rendered at the same time
 */

const util = require('util')
const LRU = require('lru-cache')
const extend = require('node.extend.without.arrays')
const { nanoid } = require('nanoid')
const parser = require('@babel/parser')
const traverse = require('@babel/traverse').default
const asyncReplace = util.promisify(require('async-replace'))
const resolveReferences = require('./resolveReferences.js')
let compiledCache

function executeEngine (reporter, inputs, onLog, done) {
  const runInSandbox = reporter.runInSandbox
  const sandboxModulesCache = inputs.safeSandboxModulesCache
  const asyncResultMap = new Map()
  let errorInAsyncHelpers = false
  let consoleFromSandbox

  try {
    inputs.templatingEngines = inputs.templatingEngines || {}
    inputs.template = extend({}, inputs.template)

    if (!compiledCache) {
      compiledCache = LRU(inputs.templatingEngines.templateCache || { max: 100 })
    }

    if (inputs.templatingEngines.templateCache && inputs.templatingEngines.templateCache.enabled === false) {
      compiledCache.reset()
    }

    inputs.data = resolveReferences(inputs.data) || {}
    inputs.data.__appDirectory = inputs.appDirectory
    inputs.data.__rootDirectory = inputs.rootDirectory
    inputs.data.__parentModuleDirectory = inputs.parentModuleDirectory
  } catch (e) {
    return done(e)
  }

  const compileEngine = inputs.engine.compile
  const executeEngine = inputs.engine.execute

  let isFromCache = true

  // wrapping with caching
  const engine = (template, helpers, data, opts) => {
    const key = template + ':' + inputs.engine.name

    if (!compiledCache.get(key)) {
      isFromCache = false
      consoleFromSandbox.log('Compiled template not found in the cache, compiling')
      compiledCache.set(key, compileEngine(template, opts))
    } else {
      consoleFromSandbox.log('Taking compiled template from engine cache')
    }

    const compiledTemplate = compiledCache.get(key)

    return executeEngine(compiledTemplate, helpers, data, opts)
  }

  const requirePaths = [
    inputs.rootDirectory,
    inputs.appDirectory,
    inputs.parentModuleDirectory
  ]

  function respondWrap (rawErr, content) {
    if (errorInAsyncHelpers) {
      return
    }

    const handleError = (errValue) => {
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
          newError = new Error(`Template execution threw with non-Error: ${JSON.stringify(errValue)}`)
        } else {
          newError = new Error(`Template execution threw with non-Error: ${errValue}`)
        }
      } else {
        if (typeof errValue === 'string') {
          newError = new Error(errValue)
        } else {
          newError = new Error(errValue.message)

          if (errValue.stack) {
            newError.stack = errValue.stack
          }
        }
      }

      return newError
    }

    if (rawErr != null) {
      return done(handleError(rawErr))
    }

    let promises

    if (asyncResultMap.size > 0) {
      promises = asyncResultMap.values()
    } else {
      promises = []
    }

    Promise.all(promises).then((asyncValues) => {
      if (errorInAsyncHelpers) {
        return
      }

      if (asyncValues.length === 0) {
        return content
      }

      return asyncReplace(content, /{#asyncHelperResult ([^{}]+)}/g, (str, p1, offset, s, replaceDone) => {
        const asyncResultId = p1
        const asyncResult = asyncResultMap.get(asyncResultId)

        if (asyncResult == null) {
          return replaceDone(null, '')
        }

        return replaceDone(null, `${asyncResult}`)
      })
    }).then((finalContent) => {
      if (errorInAsyncHelpers) {
        return
      }

      done(null, {
        content: finalContent,
        isFromCache: isFromCache
      })
    }).catch((asyncErr) => {
      done(handleError(asyncErr))
    })
  }

  function wrapHelperForAsyncSupport (fn) {
    return function (...args) {
      // important to call the helper with the current this to preserve the same behaviour
      const fnResult = fn.call(this, ...args)

      if (!util.types.isPromise(fnResult)) {
        return fnResult
      }

      const asyncResultId = nanoid(7)

      fnResult.then((value) => {
        asyncResultMap.set(asyncResultId, value)
      }).catch((asyncErr) => {
        if (errorInAsyncHelpers) {
          return
        }

        errorInAsyncHelpers = true
        respondWrap(asyncErr)
      })

      asyncResultMap.set(asyncResultId, fnResult)

      return `{#asyncHelperResult ${asyncResultId}}`
    }
  }

  runInSandbox(({ context }) => {
    context.respond(null, context.render(
      context.m.template.content,
      context.m.template.helpers,
      context.m.data,
      { require: context.require }
    ))
  }, {
    getContext: () => {
      return {
        m: inputs,
        render: engine,
        setTimeout: setTimeout,
        __appDirectory: inputs.appDirectory,
        __rootDirectory: inputs.rootDirectory,
        __parentModuleDirectory: inputs.parentModuleDirectory,
        respond: respondWrap
      }
    },
    onEval: async ({ context, run }) => {
      consoleFromSandbox = context.console
      let templateHelpers = context.m.template.helpers

      if (templateHelpers) {
        // we accept also an already filled helpers object
        if (typeof templateHelpers === 'string' || templateHelpers instanceof String) {
          const initialItemsInSandbox = Object.keys(context)

          const topLevelFns = getTopLevelFunctions(templateHelpers)

          // export the top level functions to the global scope
          const templateHelpersEval = `${templateHelpers}\n;${topLevelFns.map((fnName) => {
            return `this['${fnName}'] = ${fnName}`
          }).join(';\n')}`

          await run(templateHelpersEval, {
            filename: 'evaluate-template-engine-helpers.js'
          })

          templateHelpers = {}

          for (const [key, value] of Object.entries(context)) {
            if (typeof value === 'function' && !initialItemsInSandbox.includes(key)) {
              templateHelpers[key] = value
            }
          }
        } else {
          templateHelpers = {}
        }
      } else {
        templateHelpers = {}
      }

      Object.keys(templateHelpers).forEach((prop) => {
        templateHelpers[prop] = wrapHelperForAsyncSupport(templateHelpers[prop])
      })

      context.m.template.helpers = templateHelpers
      inputs.template.helpers = templateHelpers
    },
    fileInfo: {
      filename: 'evaluate-template-engine.js',
      mainSource: inputs.template.helpers
    },
    errorPrefix: 'Error while executing templating engine.',
    onLog,
    formatError: (error, moduleName) => {
      error.message += ` To be able to require custom modules you need to add to configuration { "allowLocalFilesAccess": true } or enable just specific module using { templatingEngines: { allowedModules": ["${moduleName}"] }`
    },
    modulesCache: sandboxModulesCache,
    globalModules: inputs.templatingEngines.nativeModules || [],
    allowedModules: inputs.templatingEngines.allowedModules,
    requirePaths,
    requireMap: (moduleName) => {
      const m = inputs.templatingEngines.modules.find((m) => m.alias === moduleName)

      if (m) {
        return require(m.path)
      }
    }
  }).catch((err) => respondWrap(err))
}

function getTopLevelFunctions (code) {
  const ast = parser.parse(code, {
    sourceType: 'script',
    allowReturnOutsideFunction: false,
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

  const names = []

  // traverse only function declaration that are defined
  // at the top level of program
  traverse(ast, {
    FunctionDeclaration: (path) => {
      if (path.parent.type === 'Program') {
        names.push(path.node.id.name)
      }
    }
  })

  return names
}

module.exports = util.promisify(executeEngine)
