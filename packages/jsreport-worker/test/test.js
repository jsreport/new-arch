const path = require('path')
const Worker = require('../')
require('should')
const jsreport = require('jsreport-core')

const workerTempDirectory = path.join(require('os').tmpdir(), 'test-jsreport-worker')
const workerTempAutoCleanupDirectory = path.join(workerTempDirectory, 'autocleanup')

describe('worker', () => {
  let worker
  let reporter

  beforeEach(async () => {
    reporter = await jsreport()
      .use(require('jsreport-handlebars')())
      .use(require('jsreport-chrome-pdf')())
      .use(require('jsreport-docker-workers')({
        customContainersPoolFactory: () => {
          return {
            containers: [{
              id: 'a',
              tempAutoCleanupLocalDirectoryPath: workerTempAutoCleanupDirectory,
              remove: () => {},
              restart: () => {},
              url: 'http://localhost:3000'
            }],
            start: () => {},
            remove: () => {}
          }
        }
      })).init()

    const workerOptions = JSON.stringify(reporter.dockerManager.workerOptions)
    const workerSystemOptions = JSON.stringify(reporter.dockerManager.workerSystemOptions)

    worker = Worker({
      workerOptions,
      workerSystemOptions,
      httpPort: 3000,
      workerTempDirectory,
      workerTempAutoCleanupDirectory
    })
    await worker.init()
  })

  afterEach(async () => {
    await reporter.close()
    await worker.close()
  })

  it('should be able to render basic template', async () => {
    const res = await reporter.render({
      template: {
        content: 'hello',
        engine: 'none',
        recipe: 'html'
      }
    })
    res.content.toString().should.be.eql('hello')
  })

  it('should propagate errors from engines', async () => {
    try {
      await
      reporter.render({
        template: {
          content: '{{#each}}',
          engine: 'handlebars',
          recipe: 'html'
        }
      })
      throw new Error('should have failed')
    } catch (e) {
      e.message.should.containEql('{{#each')
      e.stack.should.containEql('handlebars')
    }
  })
})

describe.skip('worker with small timeout', () => {
  let worker
  let reporter

  beforeEach(async () => {
    reporter = await jsreport()
      .use(require('jsreport-templates')())
      .use(require('jsreport-handlebars')())
      .use(require('jsreport-chrome-pdf')())
      .use(require('jsreport-docker-workers')({
        customContainersPoolFactory: () => {
          return {
            containers: [{
              id: 'a',
              tempAutoCleanupLocalDirectoryPath: workerTempAutoCleanupDirectory,
              remove: () => {},
              restart: () => {},
              url: 'http://localhost:3000'
            }],
            start: () => {},
            remove: () => {}
          }
        }
      })).init()

    const workerOptions = JSON.stringify(reporter.dockerManager.workerOptions)
    const workerSystemOptions = JSON.stringify(reporter.dockerManager.workerSystemOptions)

    worker = Worker({
      workerOptions,
      workerSystemOptions,
      workerCallbackTimeout: 100,
      httpPort: 3000,
      workerTempDirectory,
      workerTempAutoCleanupDirectory
    })
    await worker.init()
  })

  afterEach(async () => {
    await reporter.close()
    await worker.close()
  })

  it('should not hang when main action hangs', async () => {
    reporter.documentStore.collection('templates').beforeFindListeners.add('test', () => {
      return new Promise((resolve) => {})
    })

    return reporter.render({
      template: {
        name: 'some name'
      }
    }).should.be.rejectedWith(/foo/)
  })
})
