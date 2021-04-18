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
    workers = new Workers({
      myInitData: 'foo'
    }, {
      workerModule: path.join(__dirname, 'workers', 'simple.js'),
      numberOfWorkers: 1
    })
    await workers.init()
    const result = await workers.executeWorker({
      someData: 'hello'
    })

    result.actionData.someData.should.be.eql('hello')
    result.workerInitData.myInitData.should.be.eql('foo')
  })

  it('should be possible to execute action in main from worker', async () => {
    workers = new Workers({
    }, {
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

  it('should wait until all callbacks are processed before it exits the worker', async () => {
    workers = new Workers({
    }, {
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

  it('should restart thread on timeout', async () => {
    workers = new Workers({
    }, {
      workerModule: path.join(__dirname, 'workers', 'waitForTimeout.js'),
      numberOfWorkers: 1
    })

    await workers.init()

    await workers.executeWorker({
      delay: 200
    }, {
      executeMain: (data) => (data),
      timeout: 100
    }).should.be.rejectedWith(/Timeout during executing in worker/)

    const sequence = await workers.executeWorker({
      delay: 50
    }, {
      executeMain: (data) => (data),
      timeout: 300
    })
    sequence.should.be.eql(1)
  })
})
