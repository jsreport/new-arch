module.exports = ({
  createWorker,
  numberOfWorkers,
  initTimeout
}) => {
  return {
    init () {
      this.workers = []
      this.tasksQueue = []
      this._pendingInitializedWorkersToEventualyCleanup = []

      const workersCreateFn = []
      for (let i = 0; i < numberOfWorkers; i++) {
        workersCreateFn.push(async () => {
          const worker = createWorker()
          await worker.init({ timeout: initTimeout })
          this.workers.push(worker)
        })
      }
      return Promise.all(workersCreateFn.map(fn => fn()))
    },

    async close () {
      for (const w of this.workers) {
        await w.close()
      }
    },

    async allocate () {
      const worker = this.workers.find(w => w.isBusy !== true)
      if (worker) {
        worker.isBusy = true
        return {
          release: async () => {
            if (worker.needRestart || worker.running) {
              this.workers = this.workers.filter(w => w !== worker)
              worker.close()
              const newWorker = createWorker()
              this.workers.push(newWorker)
              await newWorker.init({ timeout: initTimeout })
            } else {
              worker.isBusy = false
            }
            this._flushTasksQueue()
          },

          execute: async (userData, options = {}) => {
            try {
              worker.running = true
              return await worker.execute(userData, options)
            } catch (e) {
              if (e.code === 'WORKER_TIMEOUT' || e.code === 'WORKER_CRASHED') {
                worker.needRestart = true
              }
              throw e
            } finally {
              worker.running = false
            }
          }
        }
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
      this.allocate().then(task.resolve).catch(task.reject)
    }
  }
}
