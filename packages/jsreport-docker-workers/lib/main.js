const createDockerManager = require('./dockerManager')
const createRemoteRequestHandler = require('./remoteRequestHandler')

module.exports = (reporter, definition) => {
  reporter.dockerManager = createDockerManager(reporter, definition.options)

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
    return reporter.express.app.post('/api/worker-docker-manager', createRemoteRequestHandler(
      reporter.dockerManager.executeScript,
      reporter.dockerManager.executeRecipe
    ))
  })

  reporter.on('after-express-static-configure', () => {
    if (!reporter.authentication) {
      return reporter.express.app.post('/api/worker-docker-manager', createRemoteRequestHandler(
        reporter.dockerManager.executeScript,
        reporter.dockerManager.executeRecipe
      ))
    }
  })

  reporter.executeScript = reporter.dockerManager.executeScript

  reporter.initializeListeners.insert({ before: 'express' }, 'docker-workers', async () => {
    reporter.extensionsManager.recipes = reporter.extensionsManager.recipes.map((r) => ({
      name: r.name,
      execute: (req, res) => {
        return reporter.dockerManager.executeRecipe(r.name, req, res)
      }
    }))

    await reporter.dockerManager.init()

    // adding the temp paths of containers for cleanup after starting all containers
    // to ensure that the path exists
    reporter.dockerManager.containersManager.containers.forEach((container) => {
      reporter.addPathToWatchForAutoCleanup(container.tempAutoCleanupLocalDirectoryPath)
    })
  })

  reporter.closeListeners.add('docker-workers', reporter.dockerManager.close)
}
