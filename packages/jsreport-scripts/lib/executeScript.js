const extend = require('node.extend.without.arrays')

module.exports = async function executeScript (reporter, inputs, req, onLog) {
  const runInSandbox = reporter.runInSandbox
  const createProxy = reporter.createProxy
  const requestContextMetaConfig = inputs.requestContextMetaConfig || {}
  let jsreportProxy
  let resolveScriptExecution
  let rejectScriptExecution

  const scriptExecutionPromise = new Promise((resolve, reject) => {
    resolveScriptExecution = resolve
    rejectScriptExecution = reject
  })

  const doneWrap = (err, customResult) => {
    if (err) {
      return rejectScriptExecution(err)
    }

    resolveScriptExecution(customResult)
  }

  inputs.request.cancel = (messageOrOptions = {}) => {
    let data = {}

    if (typeof messageOrOptions === 'string') {
      data.additionalInfo = messageOrOptions
    } else if (messageOrOptions != null) {
      const { message, statusCode } = messageOrOptions
      data.additionalInfo = message
      data.statusCode = statusCode
    }

    data.cancelRequest = true

    doneWrap(null, data)
  }

  if (inputs.response.content) {
    inputs.response.content = Buffer.from(inputs.response.content, 'binary')
  }

  const requirePaths = [
    inputs.rootDirectory,
    inputs.appDirectory,
    inputs.parentModuleDirectory
  ]

  let sandboxContext
  let restore

  const getScriptResult = function (rawErr) {
    let err

    if (rawErr != null) {
      const isErrorObj = (
        typeof rawErr === 'object' &&
        typeof rawErr.hasOwnProperty === 'function' &&
        rawErr.hasOwnProperty('message')
      )

      const isValidError = (
        isErrorObj ||
        typeof rawErr === 'string'
      )

      if (!isValidError) {
        if (Object.prototype.toString.call(rawErr) === '[object Object]') {
          err = new Error(`Script threw with non-Error: ${JSON.stringify(rawErr)}`)
        } else {
          err = new Error(`Script threw with non-Error: ${rawErr}`)
        }
      } else {
        if (typeof rawErr === 'string') {
          err = new Error(rawErr)
        } else {
          err = rawErr
        }
      }
    }

    // this will only restore original values of properties of __requext.context
    // and unwrap proxies and descriptors into new sandbox object
    const restoredSandbox = restore()

    if (
      err == null &&
      !isObject(restoredSandbox.__request.data)
    ) {
      err = new Error('Script invalid assignment: req.data must be an object, make sure you are not changing its value in the script to a non object value')
    }

    return {
      // we only propagate well known properties from the req executed in scripts
      // we also create new object that avoids passing a proxy object to rest of the
      // execution flow when script is running in in-process strategy
      request: {
        template: restoredSandbox.__request.template,
        data: err == null ? restoredSandbox.__request.data : undefined,
        options: restoredSandbox.__request.options,
        context: {
          ...restoredSandbox.__request.context,
          // take the value original evaluated, not the one from script because
          // it could had been modified
          shouldRunAfterRender: inputs.request.context.shouldRunAfterRender
        }
      },
      // creating new object avoids passing a proxy object to rest of the
      // execution flow when script is running in in-process strategy
      response: { ...restoredSandbox.__response },
      error: err ? {
        message: err.message,
        stack: err.stack
      } : undefined
    }
  }

  const initialSandbox = {
    __request: {
      ...inputs.request,
      context: { ...inputs.request.context }
    },
    __response: inputs.response,
    setTimeout: setTimeout,
    __appDirectory: inputs.appDirectory,
    __rootDirectory: inputs.rootDirectory,
    __parentModuleDirectory: inputs.parentModuleDirectory,
    __runBefore: () => {
      const shouldRunAfterRender = typeof sandboxContext.afterRender === 'function'

      inputs.request.context.shouldRunAfterRender = shouldRunAfterRender

      if (typeof sandboxContext.beforeRender === 'function') {
        if (sandboxContext.beforeRender.length === 3) {
          sandboxContext.beforeRender(sandboxContext.__request, sandboxContext.__response, (err) => doneWrap(err))
        } else {
          Promise.resolve(
            sandboxContext.beforeRender(sandboxContext.__request, sandboxContext.__response)
          ).then(() => doneWrap(), doneWrap)
        }
      } else {
        doneWrap()
      }
    },
    __runAfter: () => {
      if (typeof sandboxContext.afterRender === 'function') {
        if (sandboxContext.afterRender.length === 3) {
          sandboxContext.afterRender(sandboxContext.__request, sandboxContext.__response, (err) => doneWrap(err))
        } else {
          Promise.resolve(
            sandboxContext.afterRender(sandboxContext.__request, sandboxContext.__response)
          ).then(() => doneWrap(), doneWrap)
        }
      } else {
        doneWrap()
      }
    }
  }

  initialSandbox.__runBefore = initialSandbox.__runBefore.bind(initialSandbox)

  const filename = 'evaluate-user-script.js'

  try {
    await runInSandbox(({ context }) => {
      if (inputs.method === 'beforeRender') {
        context.__runBefore()
      } else {
        context.__runAfter()
      }
    }, {
      getContext: () => initialSandbox,
      onEval: async (params) => {
        sandboxContext = params.context
        restore = params.restore

        jsreportProxy = createProxy({
          request: req
        }, {
          afterMethodExecute: () => {
            // after proxy method execute we keep the sharedContext in sync with the
            // context of the sandbox, this is needed because the proxy methods can execute
            // actions that modify the shared context inside the script
            if (req.context.shared != null) {
              sandboxContext.__request.context.shared = extend(true, sandboxContext.__request.context.shared, req.context.shared)
            }
          }
        })

        const scriptEval = `${inputs.script}\n;if (typeof beforeRender === 'function') { this['beforeRender'] = beforeRender }\nif (typeof afterRender === 'function') { this['afterRender'] = afterRender }`

        await params.run(scriptEval, {
          filename
        })
      },
      fileInfo: {
        filename
      },
      errorPrefix: 'Error while executing user script.',
      onLog,
      formatError: (error, moduleName) => {
        error.message += ` To be able to require custom modules you need to add to configuration { "allowLocalFilesAccess": true } or enable just specific module using { "extensions": { "scripts": { "allowedModules": ["${moduleName}"] } }`
      },
      propertiesConfig: Object.keys(requestContextMetaConfig).reduce((acu, prop) => {
        // configure properties inside the context of sandbox
        acu[`__request.context.${prop}`] = requestContextMetaConfig[prop]
        return acu
      }, {}),
      allowedModules: inputs.allowedModules,
      requirePaths,
      requireMap: (moduleName) => {
        if (moduleName === 'jsreport-proxy') {
          return jsreportProxy
        }
      }
    })

    const customResult = await scriptExecutionPromise

    // if we get some result from the script execution we return that,
    // so far this is used to cancel request only
    if (customResult != null) {
      return customResult
    }

    return getScriptResult()
  } catch (e) {
    return getScriptResult(e)
  }
}

function isObject (input) {
  if (Object.prototype.toString.call(input) !== '[object Object]') {
    return false
  }

  const prototype = Object.getPrototypeOf(input)

  return prototype === null || prototype === Object.prototype
}
