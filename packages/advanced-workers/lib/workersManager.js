const { Worker } = require('worker_threads')
const path = require('path')
const ThreadWorker = require('./threadWorker')
const convertUint8ArrayToBuffer = require('./convertUint8ArrayToBuffer')
const pool = require('./pool')

module.exports = (userOptions, {
  workerModule,
  numberOfWorkers,
  resourceLimits
}) => {
  async function createWorker ({ timeout }) {
    const worker = new Worker(path.join(__dirname, 'workerHandler.js'), {
      workerData: {
        systemData: {
          workerModule
        },
        userData: userOptions
      },
      resourceLimits
    })

    const threadWorker = ThreadWorker({
      worker
    })
    await threadWorker.init({ timeout })
    return threadWorker
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

    async allocate () {
      return this.pool.allocate()
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
