const path = require('path')
const EventEmitter = require('events')
const { MessageChannel } = require('worker_threads')
const serializator = require('serializator')
const Piscina = require('piscina')
const convertUint8ArrayProperties = require('./convertUint8ArrayProperties.js')
const debug = require('debug')('advanced-workers')
const uuid = require('uuid').v4

function createDebugLogger () {
  return {
    debug: (...args) => debug('debug', ...args),
    info: (...args) => debug('info', ...args),
    warn: (...args) => debug('warn', ...args),
    error: (...args) => debug('error', ...args)
  }
}

class WorkersManager {
  constructor (userWorkerData, options, logger) {
    this._userWorkerData = userWorkerData

    this.options = Object.assign({}, options)
    this.options.numberOfWorkers = this.options.numberOfWorkers || 1
    this.logger = logger || createDebugLogger()

    this._exitListener = () => {
      this.close()
    }

    process.once('exit', this._exitListener)
  }

  async init () {
    this._workerManager = new Piscina({
      workerData: {
        systemWorkerData: {
          workerModule: this.options.workerModule
        },
        userWorkerData: this._userWorkerData
      },
      filename: path.join(__dirname, './worker.js'),
      minThreads: this.options.numberOfWorkers,
      maxThreads: this.options.numberOfWorkers,
      idleTimeout: Infinity
    })

    // NOTE: it is important to handle this error event to have thread restart working properly
    this._workerManager.on('error', (err) => {
      this.logger.error('Got uncaught exception in worker thread pool manager:', err)
    })

    let workersPendingToBeOnline = this._workerManager.threads.length

    const startExecution = {}

    startExecution.promise = new Promise((resolve) => {
      startExecution.resolve = resolve
    })

    for (const worker of this._workerManager.threads) {
      worker.once('message', (message) => {
        // we wait for the ready message, this is send
        // by piscina after waiting for the the promise initialization
        // in the worker
        if (message.ready === true) {
          workersPendingToBeOnline--
        }

        if (workersPendingToBeOnline === 0) {
          startExecution.resolve()
        }
      })
    }

    await startExecution.promise
  }

  async close () {
    if (this._workerManager) {
      try {
        await this._workerManager.destroy()
      } catch (e) {
        this.logger.error('Got exception when killing workers:', e)
      }
    }

    process.removeListener('exit', this._exitListener)
  }

  async executeWorker (userData, baseOptions) {
    const options = Object.assign({}, baseOptions)
    const timeoutValue = options.timeout == null ? -1 : options.timeout
    let executeMain

    if (options && options.executeMain) {
      executeMain = options.executeMain
      delete options.executeMain
    }

    const taskData = {
      userData,
      systemData: {
        ...options,
        rid: uuid()
      }
    }

    const executionController = {
      isDone: false,
      abortEmitter: new EventEmitter()
    }

    const execution = {}

    execution.promise = new Promise((resolve, reject) => {
      execution.resolve = resolve
      execution.reject = reject
    })

    let timeoutRef

    if (timeoutValue !== -1) {
      timeoutRef = setTimeout(() => {
        if (executionController.isDone) {
          return
        }

        executionController.isDone = true
        executionController.abortEmitter.emit('abort')

        const timeoutError = new Error()

        timeoutError.weak = true
        timeoutError.message = options.timeoutErrorMessage || 'Timeout error during executing script'
        timeoutError.message += ` (Timeout: ${timeoutValue})`

        execution.reject(timeoutError)
      }, timeoutValue)
      timeoutRef.unref()
    }

    this._runTask(
      taskData,
      executeMain,
      executionController
    ).then(({ userResult, systemResult }) => {
      clearTimeout(timeoutRef)

      if (executionController.isDone) {
        return
      }

      executionController.isDone = true

      if (systemResult.error != null) {
        const errFromResult = new Error()

        Object.assign(errFromResult, systemResult.error)

        if (errFromResult.weak == null) {
          errFromResult.weak = true
        }

        execution.reject(errFromResult)
      } else {
        convertUint8ArrayProperties(userResult)
        execution.resolve(userResult)
      }
    }).catch((err) => {
      clearTimeout(timeoutRef)

      if (executionController.isDone) {
        return
      }

      executionController.isDone = true
      execution.reject(err)
    })

    return execution.promise
  }

  async _runTask ({ userData, systemData }, executeMain, executionController) {
    // we create a message channel to be able to pass messages with the worker
    const { port1: workerPort, port2: managerPort } = new MessageChannel()

    workerPort.on('message', ({ serializedUserData, systemData }) => {
      if (systemData.action !== 'callback') {
        return
      }

      if (executionController.isDone) {
        return
      }

      const onDone = (err, userData) => {
        if (executionController.isDone) {
          return
        }

        try {
          workerPort.postMessage({
            userData,
            systemData: {
              action: 'callback-response',
              error: err,
              cid: systemData.cid
            }
          })
        } catch (e) {
          // usually error about some value could not be cloned
          workerPort.postMessage({
            systemData: {
              action: 'callback-response',
              error: e,
              cid: systemData.cid
            }
          })
        }
      }

      // only the callback data are serialized because it can contain proxied values, jsreport specific
      const parsedUserData = serializator.parse(serializedUserData)

      Promise.resolve(executeMain(parsedUserData)).then((result) => {
        onDone(null, result)
      }).catch((err) => {
        onDone(err)
      })
    })

    const result = await this._workerManager.runTask({
      userData,
      systemData: {
        ...systemData,
        managerPort
      }
    }, [managerPort], executionController.abortEmitter)

    return result
  }
}

module.exports = WorkersManager
