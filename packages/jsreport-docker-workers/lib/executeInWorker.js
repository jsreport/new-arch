const get = require('lodash.get')

module.exports = ({ reporter, containersManager, ip, stack, serversChecker, discriminatorPath }) => {
  containersManager.onRecycle(({ container, originalTenant }) => {
    return reporter.documentStore.internalCollection('tenantWorkers').remove({
      ip,
      stack,
      tenant: originalTenant
    })
  })

  async function allocateWorker ({
    discriminator,
    req
  }) {
    reporter.logger.debug(`Processing render with discriminator: ${discriminator}`)
    const serverPort = reporter.express.server.address().port

    let currentTenantWorker = await reporter.documentStore.internalCollection('tenantWorkers').findOne({
      stack,
      tenant: discriminator
    })

    if (
      currentTenantWorker &&
      (currentTenantWorker.ip !== ip ||
      (currentTenantWorker.ip === ip && currentTenantWorker.port !== serverPort))
    ) {
      reporter.logger.debug(`Found previous remote worker assigned ${currentTenantWorker.ip} (port: ${currentTenantWorker.port}, discriminator: ${discriminator}), checking status`)

      if (serversChecker.status(currentTenantWorker.ip)) {
        const remoteUrl = `http://${currentTenantWorker.ip}:${currentTenantWorker.port}/api/worker-docker-manager`

        reporter.logger.debug(`Delegating request to external worker ${currentTenantWorker.ip} (${remoteUrl}), discriminator: ${discriminator}`)

        return {
          remote: true,
          url: remoteUrl
        }
      }

      reporter.logger.debug(`Remote worker ${currentTenantWorker.ip} (port: ${currentTenantWorker.port}, discriminator: ${discriminator}) is not healthy, continuing request in local`)
    }

    await reporter.documentStore.internalCollection('tenantWorkers').update({
      stack,
      tenant: discriminator
    }, { $set: { ip, port: serverPort, stack, tenant: discriminator, updateAt: new Date() } }, { upsert: true })

    reporter.logger.debug(`Executing in local worker, port: ${serverPort}, discriminator: ${discriminator}`)

    try {
      const container = await containersManager.allocate({ req, tenant: discriminator })

      reporter.logger.debug(`Wait for container ${container.id} healthy at ${container.url} (discriminator: ${discriminator})`)

      reporter.logger.debug(`Container ${container.id} at ${container.url} ready (discriminator: ${discriminator})`)

      return container
    } catch (e) {
      e.message = `Error while trying to prepare docker container for render request (discriminator: ${discriminator}). ${e.message}`
      throw e
    }
  }

  return async (req, fn) => {
    const discriminator = get(req, discriminatorPath)

    if (discriminator == null) {
      throw reporter.createError(`No value found in request using discriminator "${discriminatorPath}", not possible to delegate requests to docker workers`)
    }

    const container = await allocateWorker({
      discriminator,
      req
    })

    let result

    try {
      result = await fn(container)
    } catch (e) {
      if (container.remote !== true) {
        reporter.logger.debug(`Work done (with error), releasing docker container (and restarting) ${container.id} (${container.url}) (discriminator: ${discriminator})`)

        containersManager.recycle({ container, originalTenant: discriminator }).catch((err) => {
          reporter.logger.error(`Error while trying to recycle container ${container.id} (${container.url}): ${err.stack}`)
        })
      } else {
        reporter.logger.debug(`Work done (with error), release of used docker container was handled in remote worker (${container.url}) (discriminator: ${discriminator})`)
      }

      throw e
    }

    if (container.remote !== true) {
      reporter.logger.debug(`Work done, releasing docker container ${container.id} (${container.url}) (discriminator: ${discriminator})`)
      await containersManager.release(container)
    } else {
      reporter.logger.debug(`Work done, release of used docker container was handled in remote worker (${container.url}) (discriminator: ${discriminator})`)
    }

    return result
  }
}
