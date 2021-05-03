const WorkerReporter = require('./reporter')

module.exports = (userInitData, { executeMain, convertUint8ArrayToBuffer }) => {
  const reporter = new WorkerReporter(userInitData, async (actionName, data, req) => {
    const actionRes = await executeMain({
      actionName,
      data
    })
    convertUint8ArrayToBuffer(actionRes)
    return actionRes
  })
  return {
    init: () => {
      return reporter.init()
    },

    execute: ({ actionName, data, req }) => {
      // we need to convert back arrays to buffer because transfer to/from thread converts buffers to array
      convertUint8ArrayToBuffer(data)

      // for perf optimization we skip possibly big object data, which doesn't includes buffers anyway
      const reqData = req.data
      delete req.data
      convertUint8ArrayToBuffer(req)
      req.data = reqData

      return reporter.executeWorkerAction(actionName, data, req)
    }
  }
}
