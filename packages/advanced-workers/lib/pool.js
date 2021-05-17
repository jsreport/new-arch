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

    async close () {
      for (const w of this.workers) {
        await w.close()
      }
    },

    async allocate () {
      const worker = this.workers.find(w => w.isBusy === false)
      if (worker) {
        worker.isBusy = true
        return {
          release: async () => {
            if (worker.needRestart) {
              worker.close()
              this.workers[this.workers.indexOf(worker)] = await createWorker({ timeout: this.initTimeout })
            }
            worker.isBusy = false
            this._flushTasksQueue()
          },

          execute: async (userData, options = {}) => {
            try {
              return await worker.execute(userData, options)
            } catch (e) {
              if (e.code === 'WORKER_TIMEOUT') {
                worker.needRestart = true
              }
              throw e
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
