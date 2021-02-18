const { createPatch } = require('./diff')
const isbinaryfile = require('isbinaryfile').isBinaryFileSync
const generateRequestId = require('../../shared/generateRequestId')

class Profiler {
  constructor (reporter) {
    this.reporter = reporter
  }

  emit (m, req, res) {
    m.timestamp = m.timpestamp || new Date().getTime()
    m.id = m.id || generateRequestId()

    if (m.previousOperationId == null && req.context.profilerLastOperationId) {
      m.previousOperationId = req.context.profilerLastOperationId
    }

    if (m.type === 'operationStart') {
      req.context.profilerLastOperationId = m.id
    }

    if (req.context.isProfilerAttached && (m.type === 'operationStart' || m.type === 'operationEnd')) {
      let content = res.content
      if (content != null) {
        if (isbinaryfile(content)) {
          content = {
            content: res.content.toString('base64'),
            encoding: 'base64'
          }
        } else {
          content = {
            content: createPatch('res', req.context.profilerResLastVal ? req.context.profilerResLastVal.toString() : '', res.content.toString(), 0),
            encoding: 'diff'
          }
        }
      }
      m.res = { content }

      const stringifiedReq = JSON.stringify({ template: req.template, data: req.data }, null, 2)
      m.req = { diff: createPatch('req', req.context.profilerReqLastVal || '', stringifiedReq, 0) }

      req.context.profilerResLastVal = res.content
      req.context.profilerReqLastVal = stringifiedReq
    }

    this.reporter.executeMainAction('profile', m, req).catch((e) => this.reporter.logger.error(e, req))
    return m.id
  }
}

module.exports = (reporter) => {
  reporter.profiler = new Profiler(reporter)
}
