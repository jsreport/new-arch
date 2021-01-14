const WorkerReporter = require('./reporter')
const _omit = require('lodash.omit')

module.exports = async (userInitData, { executeMain }) => {
  const reporter = new WorkerReporter(userInitData, (actionName, data, req) => {
    return executeMain({
      actionName,
      data,
      req: _omit(req, 'template', 'data', 'options')
    }, req.context.advancedWorkersId)
  })
  await reporter.init()

  return ({ actionName, data, req }, rid) => {
    req.context.advancedWorkersId = rid

    return reporter.executeWorkerAction(actionName, data, req)
  }
}
