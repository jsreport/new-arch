const path = require('path')
const fs = require('fs')
const Koa = require('koa')
const nconf = require('nconf')
const serializator = require('serializator')
const WorkersManager = require('advanced-workers')
const WorkerRequest = require('./workerRequest')
const { Lock } = require('semaphore-async-await')
const bootstrapFiles = []
const currentRequests = {}

const rootDir = path.join(__dirname, '../bootstrap')

fs.readdirSync(rootDir).forEach((f) => {
  if (f.endsWith('.reporter.js')) {
    const bootstrapFile = path.join(rootDir, f)
    console.log(`found bootstrap file ${bootstrapFile}`)
    bootstrapFiles.push(bootstrapFile)
  }
})

const callbackLock = new Lock()

module.exports = (options = {}) => {
  const bootstrapExports = []

  if (bootstrapFiles.length > 0) {
    for (const file of bootstrapFiles) {
      try {
        bootstrapExports.push(require(file))
      } catch (e) {
        e.message = `Error while trying to require bootstrap file in ${file}. ${e.message}`
        throw e
      }
    }
  }

  options = nconf.overrides(options).argv().env({ separator: ':' }).env({ separator: '_' }).get()
  options.httpPort = options.httpPort || 2000

  console.log(`Worker temp directory is: ${options.workerTempDirectory}`)
  console.log(`Worker temp auto cleanup directory is: ${options.workerTempAutoCleanupDirectory}`)

  if (options.workerDebuggingSession) {
    console.log('Debugging session is enabled')
  }

  options.workerInputRequestLimit = options.workerInputRequestLimit || '20mb'

  const workersManager = new WorkersManager(JSON.parse(options.workerOptions), JSON.parse(options.workerSystemOptions))

  const app = new Koa()

  app.on('error', err => {
    console.error('server error', err)
  })

  console.log(`worker input request limits is configured to: ${options.workerInputRequestLimit}`)

  app.use(require('koa-bodyparser')({
    enableTypes: ['text'],
    textLimit: options.workerInputRequestLimit
  }))

  app.use(async ctx => {
    if (ctx.method === 'GET') {
      ctx.body = 'ok'
      return
    }

    if (options.workerDebuggingSession) {
      // this line is useful for debugging, because it makes the request never
      // be aborted, which give us time to debug easily
      ctx.req.setTimeout(0)
    }

    try {
      const reqBody = serializator.parse(ctx.request.rawBody)

      const reqId = reqBody?.req?.context?.rootId

      if (!reqId) {
        throw new Error('Wrong worker request body')
      }

      console.log(reqId, reqBody.actionName)

      if (currentRequests[reqId]) {
        const workerRequest = currentRequests[reqId]
        const callbackResult = await workerRequest.processCallbackResponse(ctx.request, { data: reqBody.data })
        workersManager.convertUint8ArrayToBuffer(callbackResult)
        ctx.body = serializator.serialize(callbackResult)
        ctx.status = callbackResult.actionName ? 200 : 201
        ctx.set('Content-Type', 'text/plain')
        return
      }

      const workerRequest = currentRequests[reqId] = WorkerRequest({ uuid: reqId, data: reqBody, httpReq: ctx.request }, {
        onSuccess: ({ uuid }) => {
          delete currentRequests[uuid]
        },
        onError: ({ uuid, error, httpReq }) => {
          if (httpReq.socket.destroyed) {
            // don't clear request if the last http request
            // was destroyed already, this can only happen if there is an error
            // that is throw in worker (like a timeout) while waiting
            // for some callback response call.
            //
            // this handling gives the chance for
            // "processCallbackResponse" to run and resolve with a timeout error after
            // being detected idle for a while
            console.error(`An error was throw when there is no active http connection to respond. uuid: ${
              uuid
            } error: ${error.message}, stack: ${
              error.stack
            }, attrs: ${JSON.stringify(error)}`)
            return
          }

          delete currentRequests[uuid]
        },
        callbackTimeout: options.workerCallbackTimeout || 10000
      })

      const actionResult = await workerRequest.process(ctx.request, () => {
        return workersManager.executeWorker(reqBody, {
          executeMain: async (data) => {
            try {
              await callbackLock.acquire()
              const r = await workerRequest.callback(data)
              return r
            } finally {
              callbackLock.release()
            }
          }
        })
      })
      workersManager.convertUint8ArrayToBuffer(actionResult)

      ctx.body = serializator.serialize(actionResult)
      ctx.status = actionResult.actionName ? 200 : 201
      ctx.set('Content-Type', 'text/plain')
    } catch (e) {
      console.error(e)
      ctx.status = 400
      ctx.body = { message: e.message, stack: e.stack }
    }
  })

  Promise.all(bootstrapExports.map((bootstrapFn) => bootstrapFn({ todo: true })))

  return ({
    async init () {
      await workersManager.init()
      this.server = app.listen(options.httpPort)
    },
    async close () {
      this.server.close()
      await workersManager.close()
    }
  })
}
