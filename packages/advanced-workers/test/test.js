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
})
