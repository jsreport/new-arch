const createDockerManager = require('./dockerManager')
const serializator = require('serializator')
const express = require('express')

module.exports = (reporter, definition) => {
  reporter.documentStore.registerEntityType('ServerType', {
    ip: { type: 'Edm.String', key: true, publicKey: true },
    stack: { type: 'Edm.String' },
    ping: { type: 'Edm.DateTimeOffset' }
  })

  reporter.documentStore.registerEntitySet('servers', {
    entityType: 'jsreport.ServerType',
    humanReadableKey: 'ip',
    internal: true
  })

  reporter.documentStore.registerEntityType('TenantWorkers', {
    _id: { type: 'Edm.String', key: true, publicKey: true },
    ip: { type: 'Edm.String' },
    port: { type: 'Edm.Int32' },
    stack: { type: 'Edm.String' },
    tenant: { type: 'Edm.String' },
    updateAt: { type: 'Edm.DateTimeOffset' }
  })

  reporter.documentStore.registerEntitySet('tenantWorkers', {
    entityType: 'jsreport.TenantWorkers',
    humanReadableKey: '_id',
    internal: true
  })

  reporter.on('after-authentication-express-routes', () => {
    reporter.express.app.post('/api/worker-docker-manager', reporter.dockerManager.executeWorker.bind(reporter.dockerManager))
  })

  reporter.on('after-express-static-configure', () => {
    if (!reporter.authentication) {
      return reporter.express.app.post('/api/worker-docker-manager', express.text(), async (req, res, next) => {
        try {
          const actionData = serializator.parse(req.body)
          const result = await reporter.dockerManager.executeWorker(actionData, {
            executeMain: async (data) => {
              return reporter._invokeMainAction(data, actionData.req)
            }
          })
          res.status(201).send(serializator.serialize(result))
        } catch (e) {
          next(e)
        }
      })
    }
  })

  reporter.registerWorkersManagerFactory((options, systemOptions) => {
    reporter.dockerManager = createDockerManager(reporter, definition.options, options, systemOptions)
    reporter.closeListeners.add('docker-workers', reporter.dockerManager.close)
    return reporter.dockerManager
  })

  reporter.initializeListeners.insert({ before: 'express' }, 'docker-workers', async () => {
    await reporter.dockerManager.init()

    // adding the temp paths of containers for cleanup after starting all containers
    // to ensure that the path exists
    reporter.dockerManager.containersManager.containersPool.containers.forEach((container) => {
      reporter.addPathToWatchForAutoCleanup(container.tempAutoCleanupLocalDirectoryPath)
    })
  })
}
