const isbinaryfile = require('isbinaryfile').isBinaryFileSync
const omit = require('lodash.omit')
const { createPatch } = require('./diff')
const generateRequestId = require('../../shared/generateRequestId')

class Profiler {
  constructor (reporter) {
    this.reporter = reporter

    this.reporter.addRequestContextMetaConfig('resolvedTemplate', { sandboxHidden: true })

    this.reporter.beforeMainActionListeners.add('profiler', (actionName, data, req) => {
      if (actionName === 'log' && req.context.profiling) {
        data.previousOperationId = req.context.profiling.lastOperationId
      }
    })
  }

  emit (m, req, res) {
    m.timestamp = m.timpestamp || new Date().getTime()

    if (m.type === 'log' && !req.context.profiling) {
      return this.reporter.executeMainAction('log', m, req)
    }

    m.id = m.id || generateRequestId()

    if (m.previousOperationId == null && req.context.profiling.lastOperationId) {
      m.previousOperationId = req.context.profiling.lastOperationId
    }

    if (m.type === 'operationStart') {
      req.context.profiling.lastOperationId = m.id
    }

    if (req.context.profiling.isAttached && (m.type === 'operationStart' || m.type === 'operationEnd')) {
      let content = res.content

      if (content != null) {
        if (isbinaryfile(content)) {
          content = {
            content: res.content.toString('base64'),
            encoding: 'base64'
          }
        } else {
          content = {
            content: createPatch('res', req.context.profiling.resLastVal ? req.context.profiling.resLastVal.toString() : '', res.content.toString(), 0),
            encoding: 'diff'
          }
        }
      }

      const stringifiedResMeta = JSON.stringify(omit(res.meta, ['logs']))

      m.res = { content, meta: { diff: createPatch('resMeta', req.context.profiling.resMetaLastVal || '', stringifiedResMeta, 0) } }

      const stringifiedReq = JSON.stringify({ template: req.template, data: req.data }, null, 2)
      m.req = { diff: createPatch('req', req.context.profiling.reqLastVal || '', stringifiedReq, 0) }

      req.context.profiling.resLastVal = res.content
      req.context.profiling.resMetaLastVal = stringifiedResMeta
      req.context.profiling.reqLastVal = stringifiedReq
    }

    const emitPromise = this.reporter.executeMainAction('profile', m, req).catch((e) => this.reporter.logger.error(e, req))

    if (m.type === 'error' || (m.type === 'operationEnd' && m.subtype === 'render' && !req.context.isChildRequest)) {
      // we wait for the last operation to be sent
      return emitPromise.then(() => m.id)
    }
    return m.id
  }

  async renderStart (req, parentReq, res) {
    let templateName = 'anonymous'
    let template = req.context.resolvedTemplate

    if (parentReq) {
      template = await this.reporter.templates.resolveTemplate(req.template || {}, req)
      req.context.resolvedTemplate = template
    } else {
      template = req.context.resolvedTemplate
    }

    if (template != null && template.name != null) {
      templateName = template.name
    }

    const profilerMessage = {
      type: 'operationStart',
      subtype: 'render',
      name: templateName,
      previousOperationId: parentReq ? parentReq.context.profiling.lastOperationId : null
    }

    if (!req.context.isChildRequest) {
      profilerMessage.profileId = req.context.profiling.entity._id
    }

    req.context.profiling.renderOperationId = await this.emit(profilerMessage, req, res)
  }

  async renderEnd (req, res, err) {
    if (!err) {
      await this.emit({
        type: 'operationEnd',
        subtype: 'render',
        id: req.context.profiling.renderOperationId
      }, req, res)
    }
  }
}

module.exports = (reporter) => {
  return new Profiler(reporter)
}
