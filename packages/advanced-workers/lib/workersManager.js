const { Worker } = require('worker_threads')
const path = require('path')
const ThreadWorker = require('./threadWorker')
const convertUint8ArrayToBuffer = require('./convertUint8ArrayToBuffer')
const pool = require('./pool')

module.exports = (userOptions, {
  workerModule,
  numberOfWorkers
}) => {
  async function createWorker ({ timeout }) {
    const worker = ThreadWorker({
      worker: new Worker(path.join(__dirname, 'workerHandler.js'), {
        workerData: {
          systemData: {
            workerModule
          },
          userData: userOptions
        }
      })
    })
    await worker.init({ timeout })
    return worker
  }

  return {
    async init ({
      timeout = 0
    } = { }) {
      this.initTimeout = timeout
      this.pool = pool({
        createWorker: () => createWorker({ timeout: this.initTimeout }),
        numberOfWorkers
      })
      return this.pool.init()
    },

    async executeWorker (userData, { executeMain, timeout } = { }) {
      return this.pool.runInWorker((worker) => worker.execute(userData, { executeMain, timeout }))
    },

    close () {
      if (this.closed) {
        return
      }

      this.closed = true
      return this.pool.close()
    },

    convertUint8ArrayToBuffer
  }
}
