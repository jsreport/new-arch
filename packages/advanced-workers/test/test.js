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
    const result = await workers.executeWorker({
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
    await workers.executeWorker({})
    const result = await workers.executeWorker({})

    result.workerState.counter.should.be.eql(2)
  })

  it('should be possible to execute action in main from worker', async () => {
    workers = Workers({ }, {
      workerModule: path.join(__dirname, 'workers', 'executeMain.js'),
      numberOfWorkers: 1
    })

    await workers.init()

    const result = await workers.executeWorker({
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
      await workers.executeWorker({
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
      await workers.executeWorker({
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
      await workers.executeWorker({
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
    await workers.executeWorker({}, {
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

    const res = await workers.executeWorker({}, {
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

    return workers.executeWorker({}, {
      timeout: 20
    }).should.be.rejectedWith(/Timeout/)
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
      promises.push(workers.executeWorker({}))
    }
    await Promise.all(promises)
  })
})
