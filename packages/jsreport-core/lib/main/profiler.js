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

  reporter.renderErrorListeners.add('profiler', async (req, res, e) => {
    profilersMap.delete(req.context.rootId)

    // error alreadly appended to the profile
    if (e.profileBlobName) {
      return
    }

    // a hard error, the request doesn't reach the worker or worker failed badly
    const blobName = `${req.context.rootId}.log`
    await reporter.documentStore.collection('profiles').insert({
      templateShortid: req.template.shortid,
      timestamp: new Date(),
      finishedOn: new Date(),
      state: 'error',
      blobName: blobName
    }, req)

    await reporter.blobStorage.write(blobName, JSON.stringify({
      type: 'error',
      message: e.message,
      stack: e.stack
    }), req)
  })
}
