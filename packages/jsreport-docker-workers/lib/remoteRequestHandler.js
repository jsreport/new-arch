const serializator = require('serializator')

module.exports = (executeScript, executeRecipe) => (req, res, next) => {
  (async () => {
    if (!req.body.payload) {
      throw new Error('request to worker (remote) must contain ".payload" property in body')
    }

    const body = serializator.parse(JSON.stringify(req.body.payload))
    const type = body.type
    const reqInput = body.data
    const jsreportReq = reqInput.req

    // we need to define __isJsreportRequest__ to avoid error in render
    // from parent request
    Object.defineProperty(jsreportReq, '__isJsreportRequest__', {
      value: true,
      writable: false,
      configurable: false,
      enumerable: false
    })

    if (type === 'scriptManager') {
      const scriptResult = await executeScript(
        reqInput.inputs,
        reqInput.options,
        jsreportReq,
        true
      )

      res.set('Content-Type', 'application/json')

      return res.send(serializator.serialize({
        payload: scriptResult
      }))
    }

    if (type === 'recipe') {
      const recipeResult = await executeRecipe(
        reqInput.recipe,
        jsreportReq,
        reqInput.res,
        true
      )

      const response = {
        req: recipeResult.req,
        res: recipeResult.res
      }

      res.set('Content-Type', 'application/json')

      return res.send(serializator.serialize({
        payload: response
      }))
    }

    throw new Error(`Unsuported worker action type ${type}`)
  })().catch((e) => {
    res.status(400).json({
      message: e.message,
      stack: e.stack
    })
  })
}
