const EventEmitter = require('events')
const generateRequestId = require('../shared/generateRequestId')

module.exports = (reporter) => {
  reporter.documentStore.registerEntityType('ProfileType', {
    templateShortid: { type: 'Edm.String', referenceTo: 'templates' },
    timestamp: { type: 'Edm.DateTimeOffset', schema: { type: 'null' } },
    finishedOn: { type: 'Edm.DateTimeOffset', schema: { type: 'null' } },
    state: { type: 'Edm.String' },
    blobPersisted: { type: 'Edm.Boolean' },
    blobName: { type: 'Edm.String' },
    error: { type: 'Edm.String' }
  })

  reporter.documentStore.registerEntitySet('profiles', {
    entityType: 'jsreport.ProfileType',
    exportable: false
  })

  const profilersMap = new Map()
  const profilerAppendChain = new Map()

  async function emitProfiles (events, req) {
    for (const m of events) {
      if (m.type === 'log') {
        reporter.logger[m.level](m.message, { ...req, ...m.meta, timestamp: m.timestamp })
      }

      if (profilersMap.has(req.context.rootId)) {
        profilersMap.get(req.context.rootId).emit('profile', m)
      }
    }

    profilerAppendChain.set(req.context.rootId, profilerAppendChain.get(req.context.rootId).then(() => {
      return reporter.blobStorage.append(req.context.profiling.entity.blobName, Buffer.from(events.map(m => JSON.stringify(m)).join('\n') + '\n'), req).catch(e => {
        reporter.logger.error('Failed to append to profile blob', e)
      })
    }))
  }

  reporter.registerMainAction('profile', async (events, req) => {
    return emitProfiles(events, req)
  })

  reporter.attachProfiler = (req) => {
    req.context = req.context || {}
    req.context.rootId = reporter.generateRequestId()
    req.context.profiling = {
      isAttached: true
    }
    const profiler = new EventEmitter()
    profilersMap.set(req.context.rootId, profiler)

    return profiler
  }

  reporter.beforeRenderListeners.add('profiler', async (req, res) => {
    profilerAppendChain.set(req.context.rootId, Promise.resolve())

    req.context.profiling = req.context.profiling || {}

    let blobName = `profiles/${req.context.rootId}.log`

    const template = await reporter.templates.resolveTemplate(req)

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
    res.meta.profileId = req.context.profiling?.entity?._id
    profilersMap.delete(req.context.rootId)
    const profilerBlobPersistPromise = profilerAppendChain.get(req.context.rootId)
    profilerAppendChain.delete(req.context.rootId)

    await reporter.documentStore.collection('profiles').update({
      _id: req.context.profiling.entity._id
    }, {
      $set: {
        state: 'success',
        finishedOn: new Date()
      }
    }, req)
    profilerBlobPersistPromise.finally(() => {
      reporter.documentStore.collection('profiles').update({
        _id: req.context.profiling.entity._id
      }, {
        $set: {
          blobPersisted: true
        }
      }, req).catch((e) => reporter.logger.error('Failed to update profile blobPersisted', e))
    })
  })

  reporter.renderErrorListeners.add('profiler', async (req, res, e) => {
    try {
      res.meta.profileId = req.context.profiling?.entity?._id
      const profilerBlobPersistPromise = profilerAppendChain.get(req.context.rootId)

      if (req.context.profiling?.entity != null) {
        await reporter.documentStore.collection('profiles').update({
          _id: req.context.profiling.entity._id
        }, {
          $set: {
            state: 'error',
            finishedOn: new Date(),
            error: e.toString()
          }
        }, req)

        await emitProfiles([{
          type: 'error',
          timestamp: new Date().getTime(),
          ...e,
          id: generateRequestId(),
          stack: e.stack,
          message: e.message
        }], req)

        profilerBlobPersistPromise.finally(() => {
          reporter.documentStore.collection('profiles').update({
            _id: req.context.profiling.entity._id
          }, {
            $set: {
              blobPersisted: true
            }
          }, req).catch((e) => reporter.logger.error('Failed to update profile blobPersisted', e))
        })
      }
    } finally {
      profilersMap.delete(req.context.rootId)
      profilerAppendChain.delete(req.context.rootId)
    }
  })

  let profilesCleanupInterval
  reporter.initializeListeners.add('profiler', () => {
    reporter.documentStore.collection('profiles').beforeRemoveListeners.add('profiles', async (query, req) => {
      const profiles = await reporter.documentStore.collection('profiles').find(query, req)

      for (const profile of profiles) {
        await reporter.blobStorage.remove(profile.blobName)
      }
    })

    profilesCleanupInterval = setInterval(profilesCleanup, reporter.options.profiler.cleanupInterval)
    profilesCleanupInterval.unref()
  })

  reporter.closeListeners.add('profiler', () => {
    if (profilesCleanupInterval) {
      clearInterval(profilesCleanupInterval)
    }
  })

  let profilesCleanupRunning = false
  async function profilesCleanup () {
    if (profilesCleanupRunning) {
      return
    }
    profilesCleanupRunning = true
    try {
      const profiles = await reporter.documentStore.collection('profiles').find({}).sort({ timestamp: -1 })
      const profilesToRemove = profiles.slice(reporter.options.profiler.maxProfilesHistory)

      for (const profile of profilesToRemove) {
        await reporter.documentStore.collection('profiles').remove({
          _id: profile._id
        })
      }
    } catch (e) {
      reporter.logger.error('Profile cleanup failed', e)
    } finally {
      profilesCleanupRunning = false
    }
  }
}
