module.exports = ({
  createWorker,
  numberOfWorkers
}) => {
  return {
    init () {
      this.workers = []
      this.tasksQueue = []

      const workersCreateFn = []
      for (let i = 0; i < numberOfWorkers; i++) {
        workersCreateFn.push(async () => {
          const worker = await createWorker({ timeout: this.initTimeout })
          worker.isBusy = false
          this.workers.push(worker)
        })
      }
      return Promise.all(workersCreateFn.map(fn => fn()))
    },

    async runInWorker (fn, options = {}) {
      let worker
      if (options.workerHandle != null) {
        worker = this.workers[options.workerHandle]
      } else {
        worker = await this._allocateWorker()
      }

      try {
        const r = await fn(worker)
        if (options.keepActive) {
          return {
            result: r,
            workerHandle: this.workers.indexOf(worker)
          }
        }
        worker.isBusy = false
        return r
      } catch (e) {
        worker.isBusy = false
        if (e.code === 'WORKER_TIMEOUT') {
          worker.close()
          this.workers[this.workers.indexOf(worker)] = await createWorker({ timeout: this.initTimeout })
        }
        throw e
      } finally {
        this._flushTasksQueue()
      }
    },

    async close () {
      for (const w of this.workers) {
        await w.close()
      }
    },

    async _allocateWorker () {
      const worker = this.workers.find(w => w.isBusy === false)
      if (worker) {
        worker.isBusy = true
        return worker
      }

      return new Promise((resolve, reject) => {
        this.tasksQueue.push({ resolve, reject })
      })
    },

    _flushTasksQueue () {
      if (this.tasksQueue.length === 0) {
        return
      }

      const task = this.tasksQueue.shift()
      this._allocateWorker().then(task.resolve).catch(task.reject)
    }
  }
}
