const WorkerReporter = require('./reporter')

module.exports = async (userInitData, { executeMain, convertUint8ArrayToBuffer }) => {
  const reporter = new WorkerReporter(userInitData, async (actionName, data, req) => {
    const actionRes = await executeMain({
      actionName,
      data
    }, req.context.advancedWorkersId)
    convertUint8ArrayToBuffer(actionRes)
    return actionRes
  })
  await reporter.init()

  return ({ actionName, data, req }, rid) => {
    // we need to convert back arrays to buffer because transfer to/from thread converts buffers to array
    convertUint8ArrayToBuffer(data)

    // for perf optimization we skip possibly big object data, which doesn't includes buffers anyway
    const reqData = req.data
    delete req.data
    convertUint8ArrayToBuffer(req)
    req.data = reqData

    req.context.advancedWorkersId = rid

    return reporter.executeWorkerAction(actionName, data, req)
  }
}
