const WorkerReporter = require('./reporter')
const omit = require('lodash.omit')

module.exports = (userInitData, { executeMain, convertUint8ArrayToBuffer }) => {
  const reporter = new WorkerReporter(userInitData, async (actionName, data, req) => {
    const actionRes = await executeMain({
      actionName,
      data
    })
    convertUint8ArrayToBuffer(actionRes)
    return actionRes
  })
  let parsedReq
  return {
    init: () => {
      return reporter.init()
    },

    execute: ({ actionName, data, req }) => {
      // we need to convert back arrays to buffer because transfer to/from thread converts buffers to array
      convertUint8ArrayToBuffer(data)
      convertUint8ArrayToBuffer(req)

      if (actionName === 'parse') {
        try {
          parsedReq = {
            ...JSON.parse(req.rawContent),
            context: req.context
          }

          return omit(parsedReq, 'data')
        } catch (e) {
          e.message = 'Invalid request json: ' + e.message
          e.weak = true
          throw e
        }
      }

      if (parsedReq) {
        if (parsedReq.context.rootId === req.context.rootId) {
          req.data = parsedReq.data
        }

        parsedReq = null
      }

      return reporter.executeWorkerAction(actionName, data, req)
    }
  }
}
