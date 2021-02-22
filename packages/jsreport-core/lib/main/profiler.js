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

  function emitProfile (m, req) {
    if (profilersMap.has(req.context.rootId)) {
      profilersMap.get(req.context.rootId).emit('profile', m)
    }
  }

  reporter.beforeMainActionListeners.add('profiler', (actionName, data, req) => {
    if (actionName === 'log') {
      emitProfile({
        type: 'log',
        message: data.message,
        level: data.level,
        timestamp: data.timestamp,
        previousOperationId: data.previousOperationId
      }, req)
    }
  })

  reporter.registerMainAction('profile', emitProfile)

  reporter.attachProfiler = (req) => {
    req.context = req.context || {}
    req.context.rootId = generateRequestId()
    req.context.isProfilerAttached = true

    const profiler = new EventEmitter()
    profilersMap.set(req.context.rootId, profiler)
    return profiler
  }

  reporter.afterRenderListeners.add('profiler', (req, res) => {
    profilersMap.delete(req.context.rootId)
  })

  reporter.renderErrorListeners.add('profiler', (req, res, e) => {
    profilersMap.delete(req.context.rootId)
  })
}
