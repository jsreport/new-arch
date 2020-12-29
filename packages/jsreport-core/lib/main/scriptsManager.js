const path = require('path')
const EventEmitter = require('events')
const { MessageChannel } = require('worker_threads')
const serializator = require('serializator')
const uuid = require('uuid').v4
const Piscina = require('piscina')
const convertUint8ArrayProperties = require('../shared/convertUint8ArrayProperties')

class ScriptsManager {
  constructor (baseOptions, workerData) {
    this._isStarted = false
    this._workerData = workerData

    this.options = Object.assign({}, baseOptions)
    this.options.numberOfWorkers = this.options.numberOfWorkers || 1

    this._exitListener = () => {
      this.kill()
    }

    process.once('exit', this._exitListener)
  }

  async start () {
    this._workerManager = new Piscina({     
      workerData: this._workerData,
      filename: path.join(__dirname, '../worker/worker.js'),
      minThreads: this.options.numberOfWorkers,
      maxThreads: this.options.numberOfWorkers,
      idleTimeout: Infinity
    })

    // NOTE: it is important to handle this error event to have thread restart working properly
    this._workerManager.on('error', (err) => {
      console.error('Got uncaught exception in worker thread pool manager:', err)
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
          this._isStarted = true
          startExecution.resolve()
        }
      })
    }

    await startExecution.promise
  }

  async ensureStarted () {
    if (this._isStarted) {
      return
    }

    await this.start()
  }

  async kill () {
    if (this._workerManager) {
      this._isStarted = false

      try {
        await this._workerManager.destroy()
      } catch (e) {
        console.error('Got exception when killing workers:', e)
      }
    }

    process.removeListener('exit', this._exitListener)
  }

  async execute (inputs, baseOptions) {
    const options = Object.assign({}, baseOptions)
    const timeoutValue = options.timeout == null ? -1 : options.timeout
    let onLog
    let callback

    if (options && options.callback) {
      callback = options.callback
      delete options.callback
    }

    if (options && options.onLog) {
      onLog = options.onLog
      delete options.onLog
    }

    const taskData = {
      inputs,
      options
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
    }

    this._runTask(
      taskData,
      callback,
      onLog,
      executionController
    ).then((result) => {
      clearTimeout(timeoutRef)

      if (executionController.isDone) {
        return
      }

      executionController.isDone = true

      if (result.error != null) {
        const errFromResult = new Error()

        Object.assign(errFromResult, result.error)

        if (errFromResult.weak == null) {
          errFromResult.weak = true
        }

        execution.reject(errFromResult)
      } else {
        convertUint8ArrayProperties(result.data)
        execution.resolve(result.data)
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

  async _runTask (taskData, maincallback, onLog, executionController) {
    const rid = uuid()
    // we create a message channel to be able to pass messages with the worker
    const { port1: workerPort, port2: managerPort } = new MessageChannel()

    workerPort.on('message', (msgPayload) => {
      const { action } = msgPayload

      switch (action) {
        case 'callback': {
          if (executionController.isDone) {
            return
          }

          const onDone = (err, result) => {
            if (executionController.isDone) {
              return
            }

            const args = []

            if (err != null) {
              args.push(err.stack)
              args.push(null)
            } else {
              args.push(null)
              args.push(result)
            }

            try {
              // NOTE: we only care to serialize the data in the callback case,
              // for the rest we let the thread handle it with the data structured
              // clone algorithm
              workerPort.postMessage({
                rid: msgPayload.rid,
                cid: msgPayload.cid,
                action: 'callback-response',
                data: serializator.serialize(args)
              })
            } catch (e) {
              // usually error about some value could not be cloned
              workerPort.postMessage({
                rid: msgPayload.rid,
                cid: msgPayload.cid,
                action: 'callback-response',
                data: serializator.serialize([e.message, null])
              })
            }
          }

          // NOTE: we only care to parse the data in the callback case,
          // for the rest we let the thread handle it with the data structured
          // clone algorithm
          msgPayload.data = serializator.parse(msgPayload.data)

          maincallback(...msgPayload.data).then((result) => {
            onDone(null, result)
          }).catch((err) => {
            onDone(err)
          })

          break
        }

        case 'log': {
          if (executionController.isDone) {
            return
          }

          if (onLog != null) {
            onLog(msgPayload.data)
          }

          break
        }
      }
    })

    const result = this._workerManager.runTask({
      rid,
      data: taskData,
      managerPort
    }, [managerPort], executionController.abortEmitter)

    return result
  }
}

module.exports = ScriptsManager
