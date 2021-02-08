/*!
 * Copyright(c) 2018 Jan Blaha
 *
 * Child process script rendering html from template content, helpers and input data.
 * This script runs in the extra process because of multitenancy and security requirements, errors like infinite loop
 * should not affect other reports being rendered at the same time
 */
const LRU = require('lru-cache')
const { nanoid } = require('nanoid')

let compiledCache
module.exports = (reporter) => async ({ engine }, req) => {
  if (!compiledCache) {
    compiledCache = LRU(reporter.options.templatingEngines.templateCache || { max: 100 })
  }

  const asyncResultMap = new Map()

  if (reporter.options.templatingEngines.templateCache && reporter.options.templatingEngines.templateCache.enabled === false) {
    compiledCache.reset()
  }

  req.data.__appDirectory = reporter.options.appDirectory
  req.data.__rootDirectory = reporter.options.rootDirectory
  req.data.__parentModuleDirectory = reporter.options.parentModuleDirectory

  const executionFn = async ({ require, console, topLevelFunctions }) => {
    const key = `template:${req.template.content}:${engine.name}`

    if (!compiledCache.has(key)) {
      console.log('Compiled template not found in the cache, compiling')
      compiledCache.set(key, engine.compile(req.template.content, { require }))
    } else {
      console.log('Taking compiled template from engine cache')
    }

    const compiledTemplate = compiledCache.get(key)

    for (const h of Object.keys(topLevelFunctions)) {
      topLevelFunctions[h] = wrapHelperForAsyncSupport(topLevelFunctions[h], asyncResultMap)
    }

    const content = await engine.execute(compiledTemplate, topLevelFunctions, req.data, { require })

    await Promise.all([...asyncResultMap.keys()].map(async (k) => {
      asyncResultMap.set(k, `${await asyncResultMap.get(k)}`)
    }))

    const finalContent = content.replace(/{#asyncHelperResult ([^{}]+)}/g, (str, p1) => {
      const asyncResultId = p1
      return `${asyncResultMap.get(asyncResultId)}`
    })

    return {
      content: finalContent
    }
  }

  try {
    return await reporter.runInSandbox({
      context: {
        ...(engine.createContext ? engine.createContext() : {})
      },
      userCode: req.template.helpers,
      executionFn,
      onRequire: (moduleName, { context }) => {
        if (engine.onRequire) {
          return engine.onRequire(moduleName, { context })
        }
      }
    }, req)
  } catch (e) {
    const templatePath = req.template._id ? await reporter.folders.resolveEntityPath(req.template, 'templates', req) : 'anonymous'
    e.message = `Error when evaluating engine ${engine.name} for template ${templatePath}\n` + e.message
    throw e
  }
}

function wrapHelperForAsyncSupport (fn, asyncResultMap) {
  return function (...args) {
    // important to call the helper with the current this to preserve the same behaviour
    const fnResult = fn.call(this, ...args)

    if (fnResult == null || typeof fnResult.then !== 'function') {
      return fnResult
    }

    const asyncResultId = nanoid(7)
    asyncResultMap.set(asyncResultId, fnResult)

    return `{#asyncHelperResult ${asyncResultId}}`
  }
}
