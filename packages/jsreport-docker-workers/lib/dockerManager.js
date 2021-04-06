const ListenerCollection = require('listener-collection')
const createContainersManager = require('./containersManager')
const createServersChecker = require('./serversChecker')
const createDelegate = require('./delegate')
const createExecuteInWorker = require('./executeInWorker')
const ip = require('ip')

module.exports = (reporter, {
  discriminatorPath,
  pingServersInterval,
  pingHealthyInterval,
  container,
  subnet,
  network,
  numberOfWorkers,
  containerParallelRequestsLimit
}) => {
  const containerDelegateErrorListeners = new ListenerCollection()
  const containerDelegateRequestFilterListeners = new ListenerCollection()
  const containerDelegateResponseFilterListeners = new ListenerCollection()

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
    containerParallelRequestsLimit
  })

  const executeInWorker = createExecuteInWorker({
    reporter, containersManager, ip: reporter.options.ip, stack: reporter.options.stack, serversChecker, discriminatorPath
  })

  const delegate = createDelegate(reporter, {
    delegateTimeout: container.delegateTimeout,
    onRequestFilter: async (requestInfo) => {
      const pipe = {
        ...requestInfo
      }

      await containerDelegateRequestFilterListeners.fire(pipe)

      return pipe.reqData
    },
    onResponseFilter: async (responseInfo) => {
      const pipe = {
        ...responseInfo
      }

      await containerDelegateResponseFilterListeners.fire(pipe)

      return pipe.resData
    },
    onContainerError: async (params) => {
      return containerDelegateErrorListeners.fire(params)
    }
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

  async function executeScript (inputs, options, req, fromRemote) {
    return executeInWorker(req, (worker) => delegate.delegateScript(worker.url, worker.remote, inputs, options, req, fromRemote))
  }

  async function executeRecipe (recipe, req, res, fromRemote) {
    return executeInWorker(req, (worker) => delegate.delegateRecipe(worker.url, worker.remote, recipe, req, res, fromRemote))
  }

  return {
    serversChecker,
    containersManager,
    executeScript,
    executeRecipe,
    addContainerDelegateRequestFilterListener (name, fn) {
      containerDelegateRequestFilterListeners.add(name, async (info) => {
        // logic to filter request data shape through listeners
        const customData = await fn({ ...info })

        if (customData != null) {
          info.reqData = customData
        }
      })
    },
    removeContainerDelegateRequestFilterListener (...args) { containerDelegateRequestFilterListeners.remove(...args) },
    addContainerDelegateResponseFilterListener (name, fn) {
      containerDelegateResponseFilterListeners.add(name, async (info) => {
        // logic to filter response data shape through listeners
        const customData = await fn({ ...info })

        if (customData != null) {
          info.resData = customData
        }
      })
    },
    removeContainerDelegateResponseFilterListener (...args) { containerDelegateResponseFilterListeners.remove(...args) },
    addContainerDelegateErrorListener (...args) { containerDelegateErrorListeners.add(...args) },
    removeContainerDelegateErrorListener (...args) { containerDelegateErrorListeners.remove(...args) },
    async init () {
      await serversChecker.startPingInterval()
      await serversChecker.startStatusInterval()
      await containersManager.start()
      reporter.logger.debug(`docker manager initialized correctly`)
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
    }
  }
}
