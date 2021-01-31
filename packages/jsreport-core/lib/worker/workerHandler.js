const WorkerReporter = require('./reporter')
const _omit = require('lodash.omit')

module.exports = async (userInitData, { executeMain, convertUint8ArrayToBuffer }) => {
  const reporter = new WorkerReporter(userInitData, (actionName, data, req) => {
    return executeMain({
      actionName,
      data,
      req: _omit(req, 'template', 'data', 'options')
    }, req.context.advancedWorkersId)
  })
  await reporter.init()

  return ({ actionName, data, req }, rid) => {
    // we need to convert back arrays to buffer because transfer to/from thread converts buffers to array
    convertUint8ArrayToBuffer(data)

    // for perf optimization we skip possibly big object data, which doesn't includes buffers anyway
    const reqData = req.data
    delete req.data
    convertUint8ArrayToBuffer(req)
    reqData.data = data

    req.context.advancedWorkersId = rid

    return reporter.executeWorkerAction(actionName, data, req)
  }
}
