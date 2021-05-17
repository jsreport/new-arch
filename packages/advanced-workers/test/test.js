const Workers = require('../')
const path = require('path')
require('should')

describe('advanced workers', () => {
  let workers

  afterEach(() => {
    if (workers) {
      return workers.close()
    }
  })

  it('simple init and return should work', async () => {
    workers = Workers({
      myInitData: 'foo'
    }, {
      workerModule: path.join(__dirname, 'workers', 'simple.js'),
      numberOfWorkers: 1
    })
    await workers.init()
    const { execute } = await workers.allocate()

    const result = await execute({
      someData: 'hello',
      myBuf: Buffer.from('abc')
    })
    workers.convertUint8ArrayToBuffer(result)

    result.actionData.someData.should.be.eql('hello')
    result.actionData.myBuf.toString().should.be.eql('abc')
    result.initData.myInitData.should.be.eql('foo')
  })

  it('multiple executions should keep the same worker state', async () => {
    workers = Workers({
      myInitData: 'foo'
    }, {
      workerModule: path.join(__dirname, 'workers', 'simple.js'),
      numberOfWorkers: 1
    })
    await workers.init()
    const worker1 = await workers.allocate()
    await worker1.execute({})
    await worker1.release()
    const worker2 = await workers.allocate()
    const result = await worker2.execute({})
    await worker2.release()
    result.workerState.counter.should.be.eql(2)
  })

  it('should be possible to execute action in main from worker', async () => {
    workers = Workers({ }, {
      workerModule: path.join(__dirname, 'workers', 'executeMain.js'),
      numberOfWorkers: 1
    })

    await workers.init()

    const worker = await workers.allocate()
    const result = await worker.execute({
      someData: 'hello'
    }, {
      executeMain: (data) => (data)
    })

    result.someData.should.be.eql('hello')
  })

  it('should throw error when user code in worker throws', async () => {
    workers = Workers({ }, {
      workerModule: path.join(__dirname, 'workers', 'error.js'),
      numberOfWorkers: 1
    })
    await workers.init()

    try {
      const worker = await workers.allocate()
      await worker.execute({
        someData: 'hello'
      })
      throw new Error('should have failed')
    } catch (e) {
      e.someProp.should.be.eql('foo')
      e.message.should.containEql('my error')
      e.stack.should.containEql('error.js')
    }
  })

  it('should throw error when user code in timer in worker throws', async () => {
    workers = Workers({ }, {
      workerModule: path.join(__dirname, 'workers', 'errorInTimer.js'),
      numberOfWorkers: 1
    })
    await workers.init()

    try {
      const worker = await workers.allocate()
      await worker.execute({
        someData: 'hello'
      })
      throw new Error('should have failed')
    } catch (e) {
      e.someProp.should.be.eql('foo')
      e.message.should.containEql('my error')
      e.stack.should.containEql('errorInTimer.js')
    }
  })

  it('should pass error from the main into executeMain', async () => {
    workers = Workers({ }, {
      workerModule: path.join(__dirname, 'workers', 'executeMain.js'),
      numberOfWorkers: 1
    })
    await workers.init()

    try {
      const worker = await workers.allocate()
      await worker.execute({
        someData: 'hello'
      }, {
        executeMain: (data) => {
          const e = new Error('my error')
          e.someProp = 'foo'
          throw e
        }
      })
      throw new Error('should have failed')
    } catch (e) {
      e.someProp.should.be.eql('foo')
      e.message.should.containEql('my error')
    }
  })

  it('should wait until all callbacks are processed before it exits the worker', async () => {
    workers = Workers({ }, {
      workerModule: path.join(__dirname, 'workers', 'executeMainDontWait.js'),
      numberOfWorkers: 1
    })

    await workers.init()

    let wasResolved = false
    const worker = await workers.allocate()
    await worker.execute({}, {
      executeMain: () => {
        return new Promise((resolve) => {
          setTimeout(() => {
            wasResolved = true
            resolve()
          }, 100)
        })
      }
    })

    wasResolved.should.be.true()
  })

  it('should process parallel executeMain in correct order', async () => {
    workers = Workers({ }, {
      workerModule: path.join(__dirname, 'workers', 'parallelExecuteMain.js'),
      numberOfWorkers: 1
    })

    await workers.init()
    const worker = await workers.allocate()
    const res = await worker.execute({}, {
      executeMain: (d) => {
        return new Promise((resolve) => {
          setTimeout(() => resolve(d), Math.round(Math.random() * 10))
        })
      }
    })

    for (let i = 0; i < 10; i++) {
      res[i].should.be.eql(i)
    }
  })

  it('should throw on timeout', async () => {
    workers = Workers({ }, {
      workerModule: path.join(__dirname, 'workers', 'timeout.js'),
      numberOfWorkers: 1
    })

    await workers.init()
    const worker = await workers.allocate()
    try {
      await worker.execute({}, {
        timeout: 20
      }).should.be.rejectedWith(/Timeout/)
    } finally {
      await worker.release()
    }
  })

  it('should tollerate second close', async () => {
    workers = Workers({ }, {
      workerModule: path.join(__dirname, 'workers', 'simple.js'),
      numberOfWorkers: 1
    })

    await workers.init()
    await workers.close()
    await workers.close()
  })

  it('should queue work', async () => {
    workers = Workers({ }, {
      workerModule: path.join(__dirname, 'workers', 'queue.js'),
      numberOfWorkers: 1
    })

    await workers.init()
    const promises = []
    for (let i = 0; i < 5; i++) {
      promises.push((async () => {
        const worker = await workers.allocate()
        await worker.execute({})
        return worker.release()
      })())
    }
    await Promise.all(promises)
  })
})
