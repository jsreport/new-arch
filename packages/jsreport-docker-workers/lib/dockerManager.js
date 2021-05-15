const createContainersManager = require('./containersManager')
const createServersChecker = require('./serversChecker')
const createExecuteInWorker = require('./executeInWorker')
const sendToWorker = require('./sendToWorker')
const ip = require('ip')

module.exports = (reporter, {
  discriminatorPath,
  pingServersInterval,
  pingHealthyInterval,
  container,
  subnet,
  network,
  numberOfWorkers,
  containerParallelRequestsLimit,
  customContainersPoolFactory
}, workerOptions, workerSystemOptions) => {
  reporter.options.ip = reporter.options.ip || ip.address()

  const serversChecker = createServersChecker(reporter, {
    ip: reporter.options.ip,
    stack: reporter.options.stack,
    pingInterval: pingServersInterval,
    healthyInterval: pingHealthyInterval
  })

  const containersManager = createContainersManager({
    hostIp: reporter.options.ip,
    container,
    subnet,
    network,
    numberOfWorkers,
    logger: reporter.logger,
    tempDirectory: reporter.options.tempDirectory,
    containerParallelRequestsLimit,
    customContainersPoolFactory,
    initData: {
      workerOptions,
      workerSystemOptions
    }
  })

  const executeInWorker = createExecuteInWorker({
    reporter, containersManager, ip: reporter.options.ip, stack: reporter.options.stack, serversChecker, discriminatorPath
  })

  function onSIGTERM () {
    reporter.logger.debug(`Quiting worker, unsetting tenants with in worker ${reporter.options.ip} ${reporter.options.stack}`)

    function exit () {
      process.exit()
    }

    reporter.documentStore.internalCollection('tenantWorkers').remove({
      ip: reporter.options.ip,
      stack: reporter.options.stack
    }).then(exit, exit)
  }

  process.on('SIGTERM', onSIGTERM)

  async function executeWorker ({
    actionName,
    data,
    req
  }, {
    executeMain,
    timeout,
    keepActive,
    workerHandle
  }) {
    return executeInWorker(req, { keepActive, workerHandle }, (worker) => sendToWorker(worker.url, {
      actionName,
      data,
      req
    }, { executeMain, timeout, keepActive }))
  }

  return {
    serversChecker,
    containersManager,
    executeWorker,
    convertUint8ArrayToBuffer: () => {},
    async init () {
      await serversChecker.startPingInterval()
      await serversChecker.startStatusInterval()
      await containersManager.start()
      reporter.logger.debug('docker manager initialized correctly')
    },
    async close () {
      try {
        process.removeListener('SIGTERM', onSIGTERM)
        serversChecker.stopPingInterval()
        serversChecker.stopStatusInterval()
        await containersManager.close()
      } catch (e) {
        reporter.logger.error(`Error while trying to remove containers: ${e.message}`)
      }
    },
    workerOptions,
    workerSystemOptions
  }
}
