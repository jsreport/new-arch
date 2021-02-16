const EventEmitter = require('events')
const generateRequestId = require('../shared/generateRequestId')

module.exports = (reporter) => {
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
        previousOperationId: req.context.profilerLastOperationId
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

  reporter.beforeRenderListeners.add('profiler', (req, res) => {
    req.context.shared.profilerMessages = []
  })

  reporter.afterRenderListeners.add('profiler', (req, res) => {
    profilersMap.delete(req.context.rootId)
  })

  reporter.renderErrorListeners.add('profiler', (req) => {
    profilersMap.delete(req.context.rootId)
  })
}
