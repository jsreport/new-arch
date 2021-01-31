const { workerData } = require('worker_threads')
// eslint-disable-next-line
const domain = require('domain')
const serializator = require('serializator')
const uuid = require('uuid').v4
const convertUint8ArrayToBuffer = require('./convertUint8ArrayToBuffer.js')

const callbackRequests = {}
const callbacksMap = new Map()

async function init () {
  const workerActionHandler = await require(workerData.systemWorkerData.workerModule)(workerData.userWorkerData, {
    executeMain: (userData, rid) => callbacksMap.get(rid)(userData),
    convertUint8ArrayToBuffer
  })

  return async function workerThreadExecute ({ userData, systemData }) {
    const { managerPort, rid } = systemData

    managerPort.on('message', ({ userData, systemData }) => {
      switch (systemData.action) {
        case 'callback-response': {
          callbackRequests[rid].responseHandler({ userData, systemData })
          break
        }
      }
    })

    callbacksMap.set(rid, callback.bind(undefined, managerPort, rid))

    try {
      const res = await runInDomain(() => workerActionHandler(userData, rid))
      return {
        userResult: res,
        systemResult: { }
      }
    } catch (err) {
      return {
        systemResult: {
          error: {
            // propagate error properties
            ...Object.assign({}, err),
            message: err.message,
            stack: err.stack
          }
        }
      }
    } finally {
      callbacksMap.delete(rid)
      managerPort.close()
      // TODO, just for now, we will need to find way how to wait for all logs to finish
      delete callbackRequests[rid]
    }
  }
}

module.exports = init()

// TODO verrify we still need domans, Boris mentiones possible problems with timers in the user scripts
async function runInDomain (fn) {
  // NOTE: we're using domains here intentionally,
  // we have tried to avoid its usage but unfortunately there is no other way to
  // ensure that we are handling all kind of errors that can occur in an external script,
  // but everything is ok because node.js will only remove domains when they found an alternative
  // and when that time comes, we just need to migrate to that alternative.
  const d = domain.create()

  return new Promise((resolve, reject) => {
    d.on('error', (err) => {
      reject(err)
    })

    d.run(async () => {
      try {
        const r = await fn()
        resolve(r)
      } catch (e) {
        reject(e)
      }
    })
  })
}

function callback (managerPort, rid, callbackUserData) {
  const cid = uuid()

  callbackRequests[rid] = callbackRequests[rid] || {}
  callbackRequests[rid].executions = callbackRequests[rid].executions || {}

  if (!callbackRequests[rid].responseHandler) {
    callbackRequests[rid].responseHandler = ({ userData, systemData }) => {
      const execution = callbackRequests[rid].executions[systemData.cid]

      delete callbackRequests[rid].executions[systemData.cid]

      if (systemData.error) {
        execution.reject(systemData.error)
      } else {
        execution.resolve(userData)
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

  // no need to handle a possible error when sending here because it will be cached as
  // part of runModule error handler
  // only the callback data are serialized because it can contain proxied values, jsreport specific
  managerPort.postMessage({
    serializedUserData: serializator.serialize(callbackUserData),
    systemData: {
      action: 'callback',
      rid,
      cid
    }
  })

  return execution.promise
}
