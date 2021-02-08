const extend = require('node.extend.without.arrays')
const _omit = require('lodash.omit')
const promisify = require('util').promisify

module.exports = async function executeScript (reporter, script, method, req, res) {
  const requestContextMetaConfig = reporter.getRequestContextMetaConfig() || {}
  let jsreportProxy = reporter.createProxy({ req })

  const initialContext = {
    __request: {
      ..._omit(extend(true, req), 'data'),
      data: {
        ...req.data
      }
    },
    __response: res
  }

  initialContext.__request.cancel = (messageOrOptions = {}) => {
    let data = {}

    if (typeof messageOrOptions === 'string') {
      data.additionalInfo = messageOrOptions
    } else if (messageOrOptions != null) {
      const { message, statusCode } = messageOrOptions
      data.additionalInfo = message
      data.statusCode = statusCode
    }

    data.requestCancel = true

    const cancellationError = new Error('Cancel scripts')
    cancellationError.isRequestCancel = true
    cancellationError.data = data
    throw cancellationError
  }

  const executionFn = async ({ topLevelFunctions, restore, context }) => {
    try {
      if (method === 'beforeRender' && topLevelFunctions.beforeRender) {
        if (topLevelFunctions.beforeRender.length === 3) {
          await promisify(topLevelFunctions.beforeRender)(context.__request, context.__response)
        } else {
          await topLevelFunctions.beforeRender(context.__request, context.__response)
        }
      }

      if (method === 'afterRender' && topLevelFunctions.afterRender) {
        if (topLevelFunctions.afterRender.length === 3) {
          await promisify(topLevelFunctions.afterRender)(context.__request, context.__response)
        } else {
          await topLevelFunctions.afterRender(context.__request, context.__response)
        }
      }
    } catch (e) {
      if (e.isRequestCancel) {
        return e.data
      }
      throw e
    }

    let err = null
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
      shouldRunAfterRender: topLevelFunctions.afterRender != null,
      // we only propagate well known properties from the req executed in scripts
      // we also create new object that avoids passing a proxy object to rest of the
      // execution flow when script is running in in-process strategy
      req: {
        template: restoredSandbox.__request.template,
        data: err == null ? restoredSandbox.__request.data : undefined,
        options: restoredSandbox.__request.options,
        context: {
          ...restoredSandbox.__request.context
        }
      },
      // creating new object avoids passing a proxy object to rest of the
      // execution flow when script is running in in-process strategy
      res: { ...restoredSandbox.__response },
      error: err ? {
        message: err.message,
        stack: err.stack
      } : undefined
    }
  }

  try {
    return await reporter.runInSandbox({
      context: initialContext,
      userCode: script.content,
      executionFn,
      onRequire: (moduleName) => {
        if (moduleName === 'jsreport-proxy') {
          return jsreportProxy
        }
      },
      propertiesConfig: Object.keys(requestContextMetaConfig).reduce((acu, prop) => {
      // configure properties inside the context of sandbox
        acu[`__request.context.${prop}`] = requestContextMetaConfig[prop]
        return acu
      }, {})
    }, req)
  } catch (e) {
    const scriptPath = script._id ? await reporter.folders.resolveEntityPath(script, 'scripts', req) : 'anonymous'
    e.message = `Error when evaluating custom script ${scriptPath}\n` + e.message
    throw e
  }
}

function isObject (input) {
  if (Object.prototype.toString.call(input) !== '[object Object]') {
    return false
  }

  const prototype = Object.getPrototypeOf(input)

  return prototype === null || prototype === Object.prototype
}
