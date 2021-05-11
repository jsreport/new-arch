const EventEmitter = require('events')
const generateRequestId = require('../shared/generateRequestId')

module.exports = (reporter) => {
  reporter.documentStore.registerEntityType('ProfileType', {
    templateShortid: { type: 'Edm.String', referenceTo: 'templates' },
    timestamp: { type: 'Edm.DateTimeOffset', schema: { type: 'null' } },
    finishedOn: { type: 'Edm.DateTimeOffset', schema: { type: 'null' } },
    state: { type: 'Edm.String' },
    blobName: { type: 'Edm.String' },
    error: { type: 'Edm.String' }
  })

  reporter.documentStore.registerEntitySet('profiles', {
    entityType: 'jsreport.ProfileType',
    exportable: false
  })

  const profilersMap = new Map()

  async function emitProfile (m, req, writeToLogger = true) {
    // we need this just for errors not handled in worker
    if (m.type === 'operationStart') {
      req.context.profilerLastOperationId = m.id
    }

    if (m.type === 'log' && writeToLogger) {
      reporter.logger[m.level](m.message, { ...req, ...m.meta, timestamp: m.timestamp })
    }

    if (profilersMap.has(req.context.rootId)) {
      profilersMap.get(req.context.rootId).emit('profile', m)
    }

    await reporter.blobStorage.append(req.context.profiling.entity.blobName, Buffer.from(JSON.stringify(m) + '\n'), req)
  }

  reporter.registerMainAction('profile', async (messages, req) => {
    for (const message of messages) {
      await emitProfile(message, req)
    }
  })

  reporter.attachProfiler = (req) => {
    req.context = req.context || {}
    req.context.rootId = generateRequestId()
    req.context.profiling = {
      isAttached: true
    }

    const profiler = new EventEmitter()
    profilersMap.set(req.context.rootId, profiler)
    return profiler
  }

  reporter.beforeRenderListeners.add('profiler', async (req, res) => {
    req.context.profiling = req.context.profiling || {}

    let blobName = `profiles/${req.context.rootId}.log`

    const template = await reporter.templates.resolveTemplate(req.template || {}, req)

    if (template && template._id) {
      const templatePath = await reporter.folders.resolveEntityPath(template, 'templates', req)
      blobName = `profiles/${templatePath.substring(1)}/${req.context.rootId}.log`
      req.context.resolvedTemplate = template
    }

    const profile = await reporter.documentStore.collection('profiles').insert({
      templateShortid: template != null ? template.shortid : null,
      timestamp: new Date(),
      state: 'running',
      blobName
    }, req)

    req.context.profiling.entity = profile

    if (!req.context.profiling.isAttached) {
      const setting = await reporter.documentStore.collection('settings').findOne({ key: 'fullProfilerRunning' }, req)
      if (setting && JSON.parse(setting.value)) {
        req.context.profiling.isAttached = true
      }
    }
  })

  reporter.afterRenderListeners.add('profiler', async (req, res) => {
    profilersMap.delete(req.context.rootId)

    await reporter.documentStore.collection('profiles').update({
      _id: req.context.profiling.entity._id
    }, {
      $set: {
        state: 'success',
        finishedOn: new Date()
      }
    }, req)
  })

  reporter.renderErrorListeners.add('profiler', async (req, res, e) => {
    try {
      if (req.context.profiling.entity != null) {
        await reporter.documentStore.collection('profiles').update({
          _id: req.context.profiling.entity._id
        }, {
          $set: {
            state: 'error',
            finishedOn: new Date(),
            error: e.toString()
          }
        }, req)

        await emitProfile({
          type: 'log',
          timestamp: new Date().getTime(),
          id: generateRequestId(),
          level: 'error',
          message: e.stack,
          previousOperationId: req.context.profilerLastOperationId
        }, req, false)

        await emitProfile({
          type: 'error',
          timestamp: new Date().getTime(),
          ...e,
          id: generateRequestId(),
          stack: e.stack,
          message: e.message,
          previousOperationId: req.context.profilerLastOperationId
        }, req)
      }
    } finally {
      profilersMap.delete(req.context.rootId)
    }
  })
}
