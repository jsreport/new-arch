const os = require('os')
const jsreport = require('jsreport-core')
const should = require('should')

describe('servers checker', () => {
  let reporter

  beforeEach(() => {
    const options = {
      store: {
        provider: 'fs'
      },
      extensions: {
        'docker-workers': {
          numberOfWorkers: 1,
          pingInterval: 10,
          discriminatorPath: 'context.tenant'
        },
        fsStore: {
          dataDirectory: 'temp'
        }
      }
    }

    if (os.type() === 'Darwin') {
      // this is needed because default temp directory is not shared from OSX and Docker
      // so it fails, we need to use default shared directory "/tmp"
      options.tempDirectory = '/tmp/jsreport-docker-workers'
    }

    return (reporter = jsreport(options)).use(require('../')()).use(require('jsreport-fs-store')()).init()
  })

  afterEach(() => reporter.close())

  it('current server should have ok status', () => reporter.dockerManager.serversChecker.status(reporter.options.ip).should.be.ok())
  it('not existing server should have false status', () => should(reporter.dockerManager.serversChecker.status('foo')).not.be.ok())

  it('current server should not be ok for healthyInterval 0', () => {
    reporter.dockerManager.serversChecker.healthyInterval = 0
    should(reporter.dockerManager.serversChecker.status('0.0.0.0')).not.be.ok()
  })
})
