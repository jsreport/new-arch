const core = require('../../index')
const os = require('os')
const should = require('should')

describe('discover', () => {
  let reporter

  beforeEach(async () => {
    reporter = core({
      discover: true,
      useExtensionsLocationCache: false,
      rootDirectory: __dirname,
      tempCoreDirectory: os.tmpdir()
    })
  })

  afterEach(async () => {
    if (reporter) {
      await reporter.close()
    }
  })

  it('should find the extension', async () => {
    await reporter.init()

    // discover founds also intentional duplicate which is filtered out in extension manager
    // there is no extra test for duplicate filtering because everything else would fail
    should(reporter.extensionsManager.extensions.length > 0).be.true()
  })
})
