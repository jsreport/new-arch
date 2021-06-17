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

    this.profiledRequestsMap = new Map()
    const profileMessagesFushInterval = setInterval(async () => {
      for (const id of [...this.profiledRequestsMap.keys()]) {
        const profilingInfo = this.profiledRequestsMap.get(id)
        if (profilingInfo) {
          const batch = profilingInfo.batch
          profilingInfo.batch = []
          await this.reporter.executeMainAction('profile', batch, profilingInfo.req).catch((e) => this.reporter.logger.error(e, profilingInfo.req))
        }
      }
    }, 100)
    profileMessagesFushInterval.unref()

    this.reporter.closeListeners.add('profiler', this, () => {
      if (profileMessagesFushInterval) {
        clearInterval(profileMessagesFushInterval)
      }
    })
  }

  emit (m, req, res) {
    m.timestamp = m.timpestamp || new Date().getTime()

    if (m.type === 'log' && !req.context.profiling) {
      // this means there is an action running, but not the render, and it is logging...
      return this.reporter.executeMainAction('log', m, req)
    }

    m.id = generateRequestId()
    if (m.previousEventId == null && req.context.profiling.lastEventId) {
      m.previousEventId = req.context.profiling.lastEventId
    }

    if (m.type !== 'log') {
      req.context.profiling.lastEventId = m.id
    }

    m.operationId = m.operationId || generateRequestId()
    if (m.previousOperationId == null && req.context.profiling.lastOperationId) {
      m.previousOperationId = req.context.profiling.lastOperationId
    }

    if (m.type === 'operationStart') {
      req.context.profiling.lastOperationId = m.operationId
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

    if (!this.profiledRequestsMap.has(req.context.rootId)) {
      this.profiledRequestsMap.set(req.context.rootId, { req, batch: [] })
    }

    this.profiledRequestsMap.get(req.context.rootId).batch.push(m)
    return m
  }

  async renderStart (req, parentReq, res) {
    let templateName = 'anonymous'
    let template = req.context.resolvedTemplate

    if (parentReq) {
      template = await this.reporter.templates.resolveTemplate(req)
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

    return this.emit(profilerMessage, req, res)
  }

  async renderEnd (operationId, req, res, err) {
    if (err) {
      err.previousOperationId = err.previousOperationId || req.context.profiling.lastOperationId
    } else {
      await this.emit({
        type: 'operationEnd',
        subtype: 'render',
        operationId
      }, req, res)
    }

    if (!req.context.isChildRequest) {
      const profilingInfo = this.profiledRequestsMap.get(req.context.rootId)
      if (profilingInfo) {
        this.profiledRequestsMap.delete(req.context.rootId)
        await this.reporter.executeMainAction('profile', profilingInfo.batch, req)
      }
    }
  }
}

module.exports = (reporter) => {
  return new Profiler(reporter)
}
