const jsreport = require('../../index')
require('should')

describe('listeners extension', () => {
  let reporter

  beforeEach(() => {
    reporter = jsreport()
    reporter.use(require('./listeners/jsreport.config.js'))
    return reporter.init()
  })

  afterEach(async () => {
    if (reporter) {
      await reporter.close()
    }
  })

  it('should expose beforeRenderListeners to the main and provide request', async () => {
    let _req
    reporter.beforeRenderListeners.add('test', (req, res) => {
      _req = req
    })

    await reporter.render({
      template: {
        content: 'foo',
        engine: 'none',
        recipe: 'html'
      }
    })
    _req.template.content.should.be.eql('foo')
  })
})
