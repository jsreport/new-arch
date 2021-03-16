const { createPatch } = require('./diff')
const isbinaryfile = require('isbinaryfile').isBinaryFileSync
const generateRequestId = require('../../shared/generateRequestId')

class Profiler {
  constructor (reporter) {
    this.reporter = reporter
    this.reporter.beforeMainActionListeners.add('profiler', (actionName, data, req) => {
      if (actionName === 'log' && req.context.shared.profilerMessages) {
        data.previousOperationId = req.context.profilerLastOperationId
        req.context.shared.profilerMessages.push({
          type: 'log',
          message: data.message,
          level: data.level,
          timestamp: data.timestamp
        })
      }
    })
  }

  emit (m, req, res) {
    m.timestamp = m.timpestamp || new Date().getTime()

    if (m.type === 'log' && !req.context.shared && !req.context.shared.profilerMessages) {
      return this.reporter.executeMainAction('log', m, req)
    }

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

    req.context.shared.profilerMessages.push(m)

    this.reporter.executeMainAction('profile', m, req).catch((e) => this.reporter.logger.error(e, req))
    return m.id
  }

  async renderStart (req, parentReq, res) {
    req.context.shared.profilerMessages = req.context.shared.profilerMessages || []
    if (!req.context.isChildRequest) {
      const blobName = `${req.context.rootId}.log`
      const profile = await this.reporter.documentStore.collection('profiles').insert({
        templateShortid: 'foo',
        timestamp: new Date(),
        state: 'running',
        blobName
      }, req)
      req.context.profileBlobName = profile.blobName

      if (!req.context.isProfilerAttached) {
        const setting = await this.reporter.documentStore.collection('settings').findOne({ key: 'fullProfilerRunning' }, req)
        if (setting && JSON.parse(setting.value)) {
          req.context.isProfilerAttached = true
        }
      }
    }

    req.context.renderProfileId = this.emit({
      type: 'operationStart',
      subtype: 'render',
      name: 'start',
      previousOperationId: parentReq ? parentReq.context.profilerLastOperationId : null
    }, req, res)
  }

  async renderEnd (req, res, err) {
    if (err) {
      this.emit({
        type: 'error',
        ...err,
        stack: err.stack,
        message: err.message,
        id: req.context.renderProfileId
      }, req, res)
      err.profileBlobName = req.context.profileBlobName
    }

    this.emit({
      type: 'operationEnd',
      id: req.context.renderProfileId
    }, req, res)

    await this.reporter.documentStore.collection('profiles').update({
      blobName: req.context.profileBlobName
    }, {
      $set: {
        templateShortid: req.template.shortid,
        state: err ? 'error' : 'success',
        error: err ? err.stack : null,
        finishedOn: new Date()
      }
    }, req)

    const content = req.context.shared.profilerMessages.map(m => JSON.stringify(m)).join('\n')
    await this.reporter.blobStorage.write(req.context.profileBlobName, content, req)
  }
}

module.exports = (reporter) => {
  return new Profiler(reporter)
}
