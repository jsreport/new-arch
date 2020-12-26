const util = require('util')
const { workerData } = require('worker_threads')
// eslint-disable-next-line
const domain = require('domain')
const serializator = require('serializator')
const uuid = require('uuid').v4
const WorkerReporter = require('./reporter')
const convertUint8ArrayProperties = require('../shared/convertUint8ArrayProperties')
const getLogMeta = require('../shared/getLogMeta')

const callbackRequests = {}
const registry = new Map()
let reporter

async function reporterInit () {
  reporter = new WorkerReporter(
    workerData,
    registry
  )

  await reporter.init()

  return async function workerThreadExecute (payload) {
    const { managerPort } = payload

    managerPort.on('message', (msgPayload) => {
      const { action } = msgPayload

      switch (action) {
        case 'callback-response': {
          // we will receive here the response of callback execution
          const { rid, cid, data } = msgPayload

          // NOTE: we only care to parse the data in the callback case,
          // for the rest we let the thread handle it with the data structured
          // clone algorithm
          const pData = serializator.parse(data)

          callbackRequests[rid].responseHandler({
            cid,
            params: pData
          })

          break
        }
      }
    })

    const { rid, data } = payload
    const { inputs, options } = data

    convertUint8ArrayProperties(inputs)

    const threadLogger = createThreadLogger(rid, managerPort)

    inputs.registry = {
      set: (key, value) => registry.set(key, value),
      delete: (key) => registry.delete(key)
    }

    const result = await runModule({
      execModulePath: options.execModulePath,
      useReporter: options.useReporter,
      inputs,
      logger: threadLogger,
      callback: callback.bind(undefined, managerPort, rid)
    })

    managerPort.close()

    return result
  }
}

module.exports = reporterInit()

async function runModule ({ execModulePath, useReporter, inputs, logger, callback }) {
  return new Promise((resolve) => {
    // NOTE: we're using domains here intentionally,
    // we have tried to avoid its usage but unfortunately there is no other way to
    // ensure that we are handling all kind of errors that can occur in an external script,
    // but everything is ok because node.js will only remove domains when they found an alternative
    // and when that time comes, we just need to migrate to that alternative.
    const d = domain.create()

    d.on('error', (err) => {
      resolve(createErrorResponse(err))
    })

    d.run(() => {
      try {
        const module = require(execModulePath)
        const args = []

        if (useReporter) {
          args.push(reporter)
          args.push(inputs)
          args.push(logger)
          args.push(callback)
        } else {
          args.push(inputs)
          args.push(logger)
          args.push(callback)
        }

        const modulePromise = module(...args)

        if (!util.types.isPromise(modulePromise)) {
          throw new Error(`Module "${execModulePath}" does not return a promise, it can not be executed. make sure it is an async function or that it returns a promise`)
        }

        modulePromise.then((result) => {
          const response = {
            data: result
          }

          resolve(response)
        }).catch((e) => resolve(createErrorResponse(e)))
      } catch (e) {
        resolve(createErrorResponse(e))
      }
    })
  })
}

function callback (managerPort, rid, ...args) {
  const cid = uuid()

  callbackRequests[rid] = callbackRequests[rid] || {}
  callbackRequests[rid].executions = callbackRequests[rid].executions || {}

  if (!callbackRequests[rid].responseHandler) {
    callbackRequests[rid].responseHandler = (resPayload) => {
      if (resPayload.params[0] != null) {
        resPayload.params[0] = new Error(resPayload.params[0])
      }

      const execution = callbackRequests[rid].executions[resPayload.cid]

      delete callbackRequests[rid].executions[resPayload.cid]

      if (resPayload.params[0] != null) {
        execution.reject(resPayload.params[0])
      } else {
        execution.resolve(resPayload.params[1])
      }

      if (Object.keys(callbackRequests[rid].executions).length === 0) {
        delete callbackRequests[rid]
      }
    }
  }

  const execution = {}

  execution.promise = new Promise((resolve, reject) => {
    execution.resolve = resolve
    execution.reject = reject
  })

  callbackRequests[rid].executions[cid] = execution

  // NOTE: no need to handle a possible error when sending here because it will be cached as
  // part of runModule error handler
  // NOTE: we only care to serialize the data in the callback case,
  // for the rest we let the thread handle it with the data structured
  // clone algorithm
  managerPort.postMessage({
    rid,
    cid,
    action: 'callback',
    data: serializator.serialize(args.sort())
  })

  return execution.promise
}

function createThreadLogger (rid, managerPort) {
  function logFn (level, ...args) {
    const lastArg = args.slice(-1)[0]
    let msgArgs = args
    let timestamp

    if (lastArg != null && typeof lastArg === 'object') {
      msgArgs = args.slice(0, -1)

      if (lastArg.timestamp != null) {
        timestamp = lastArg.timestamp
      }
    }

    const log = {
      timestamp: timestamp != null ? timestamp : new Date().getTime(),
      level: level,
      message: util.format.apply(util, msgArgs)
    }

    const meta = getLogMeta(level, log.message, lastArg)

    if (meta != null) {
      log.meta = meta
    }

    try {
      managerPort.postMessage({
        rid,
        action: 'log',
        data: log
      })
    } catch (e) {
      console.warn('Error in worker thread while trying to send log', e)
    }
  }

  return {
    debug: (...args) => logFn('debug', ...args),
    info: (...args) => logFn('info', ...args),
    warn: (...args) => logFn('warn', ...args),
    error: (...args) => logFn('error', ...args)
  }
}

function createErrorResponse (err) {
  const response = {
    error: {
      // propagate error properties
      ...Object.assign({}, err),
      message: err.message,
      stack: err.stack
    }
  }

  return response
}
