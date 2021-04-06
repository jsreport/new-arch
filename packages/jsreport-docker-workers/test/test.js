const os = require('os')
const path = require('path')
const should = require('should')
const parsePdf = require('parse-pdf')
const jsreport = require('jsreport-core')
const extend = require('node.extend')
const utils = require('./utils')

const IS_LINUX = process.platform === 'linux'
const hostIp = process.env.hostIp
const testTenant = 'testTenant'

function createReporterInstance (customOptions = {}, authEnabled) {
  const defaultOptions = {
    allowLocalFilesAccess: true,
    templatingEngines: { strategy: 'in-process', timeout: 70000000 },
    extensions: {
      'docker-workers': {
        numberOfWorkers: 2
      }
    }
  }

  if (os.type() === 'Darwin') {
    defaultOptions.tempDirectory = '/tmp/jsreport-docker-workers'
  }

  const options = extend(true, defaultOptions, customOptions)

  if (authEnabled) {
    options.extensions = options.extensions || {}
    options.extensions.authentication = options.extensions.authentication || {}
    options.extensions.authentication.cookieSession = options.extensions.authentication.cookieSession || {}
    options.extensions.authentication.enabled = true
    options.extensions.authentication.admin = { username: 'admin', password: '1234' }
    options.extensions.authentication.cookieSession.secret = '<some secret>'
  }

  const instance = jsreport(options)

  instance
    .use({
      name: 'app',
      directory: __dirname,
      main: (reporter, definition) => {
        reporter.beforeRenderListeners.add('app', async (req, res) => {
          req.context.tenant = req.context.tenant || testTenant
        })
      }
    })
    .use(require('jsreport-fs-store')())
    .use(require('jsreport-express')())
    .use(require('jsreport-chrome-pdf')())
    .use(require('jsreport-handlebars')())
    .use(require('jsreport-scripts')())

  if (authEnabled) {
    instance.use(require('jsreport-authentication')())
  }

  instance.use(require('../')({
    discriminatorPath: 'context.tenant'
  }))

  return instance
}

function addLogsRewriter (reporter, logs) {
  const foundIndex = reporter.logger.rewriters.findIndex((r) => r.customRewriterForTest === true)

  // avoid creating a leak of rewriters
  if (foundIndex !== -1) {
    reporter.logger.rewriters.splice(foundIndex, 1)
  }

  const rewriter = (level, msg, meta) => {
    logs.push(msg)
    return meta
  }

  rewriter.customRewriterForTest = true

  reporter.logger.rewriters.push(rewriter)
}

describe('docker render', () => {
  let reporter
  let logs = []

  beforeEach(async () => {
    logs = []

    reporter = createReporterInstance()

    await reporter.init()

    addLogsRewriter(reporter, logs)
  })

  afterEach(async () => {
    if (reporter) {
      await reporter.close()
    }
  })

  it('should render', async () => {
    const res = await reporter.render({
      template: {
        content: '{{foo}}',
        recipe: 'html',
        engine: 'handlebars'
      },
      data: {
        foo: 'hello'
      }
    })

    res.content.toString().should.be.eql('hello')
  })

  it('should render chrome-pdf in worker', async () => {
    const res = await reporter.render({
      template: {
        content: 'foo',
        recipe: 'chrome-pdf',
        engine: 'none'
      }
    })

    const parsed = await parsePdf(res.content)

    parsed.pages[0].text.should.be.eql('foo')
    logs.should.matchAny(/Delegating recipe/)
  })

  it('should also render headers in pdf', async () => {
    const res = await reporter.render({
      template: {
        content: 'foo',
        recipe: 'chrome-pdf',
        engine: 'none',
        chrome: { headerTemplate: 'header' }
      }
    })

    res.content.toString().should.containEql('PDF')

    logs.should.matchAny(/Processing render callback/)
  })

  it('should render both header and footer in worker', async () => {
    const res = await reporter.render({
      template: {
        content: 'foo',
        recipe: 'chrome-pdf',
        engine: 'none',
        chrome: { headerTemplate: 'header', footerTemplate: 'footer' }
      }
    })

    res.content.toString().should.containEql('PDF')

    logs
      .filter(m => /Processing render callback/.test(m))
      .should.have.length(2)
  })

  it('should evaluate handlebars in worker', async () => {
    const res = await reporter.render({
      template: {
        content: '{{foo}}',
        recipe: 'html',
        engine: 'handlebars'
      },
      data: { foo: 'hello' }
    })

    res.content.toString().should.be.eql('hello')

    logs.should.matchAny(/Delegating script/)
  })

  it('should call error listener when there was an error in delegate execution', async () => {
    let renderError
    let delegateErrorInfo

    reporter.dockerManager.addContainerDelegateErrorListener('testing-worker-manager', (params) => {
      delegateErrorInfo = params
    })

    try {
      await reporter.render({
        template: {
          content: 'foo {{',
          recipe: 'chrome-pdf',
          engine: 'handlebars'
        }
      })
    } catch (e) {
      renderError = e
    }

    should(delegateErrorInfo.type).be.eql('scriptManager')
    should(delegateErrorInfo.error).be.Error()
    should(delegateErrorInfo.data.req).be.ok()
    should(renderError).be.Error()
  })

  it('should call error listener and support throwing custom error', async () => {
    let renderError
    let delegateErrorInfo

    reporter.dockerManager.addContainerDelegateErrorListener('testing-worker-manager', (params) => {
      delegateErrorInfo = params

      throw new Error('Testing error')
    })

    try {
      await reporter.render({
        template: {
          content: 'foo {{',
          recipe: 'chrome-pdf',
          engine: 'handlebars'
        }
      })
    } catch (e) {
      renderError = e
    }

    should(delegateErrorInfo.type).be.eql('scriptManager')
    should(delegateErrorInfo.error).be.Error()
    should(delegateErrorInfo.data.req).be.ok()
    should(renderError).be.Error()
    should(renderError.message).be.eql('Testing error')
  })

  it('should keep properties assigned to req objects during script execution', async () => {
    let sameInReq = false
    let sameInRes = false

    reporter.afterRenderListeners.add('app', async (req, res) => {
      sameInReq = req.data.someProp === true
      sameInRes = res.meta.someProp === true
    })

    await reporter.render({
      template: {
        content: '{{foo}}',
        recipe: 'html',
        engine: 'handlebars',
        scripts: [{
          content: `
            function beforeRender (req, res) {
              req.data.someProp = true
            }

            function afterRender (req, res) {
              res.meta.someProp = true
            }
          `
        }]
      },
      data: { foo: 'hello' }
    })

    sameInReq.should.be.True()
    sameInRes.should.be.True()
  })
})

describe('docker worker-container rotation', () => {
  let reporter
  let logs = []

  beforeEach(async () => {
    logs = []

    reporter = createReporterInstance()

    await reporter.init()

    addLogsRewriter(reporter, logs)
  })

  afterEach(async () => {
    if (reporter) {
      await reporter.close()
    }
  })

  it('should process request when tenant does not have a worker', async () => {
    const res = await reporter.render({
      template: {
        content: '{{foo}}',
        recipe: 'chrome-pdf',
        engine: 'handlebars'
      },
      data: {
        foo: 'foo'
      }
    })

    const parsed = await parsePdf(res.content)

    parsed.pages[0].text.should.be.eql('foo')

    reporter.dockerManager.containersManager.containers[0].lastUsed.should.be.ok()
    reporter.dockerManager.containersManager.containers.forEach((c) => c.numberOfRestarts.should.be.eql(0))
  })

  it('should find LRU worker', async () => {
    const lastContainerIndex = reporter.dockerManager.containersManager.containers.length - 1
    const container = reporter.dockerManager.containersManager.containers[lastContainerIndex]

    container.lastUsed = new Date(Date.now() - 60000)

    const res = await reporter.render({
      template: {
        content: '{{foo}}',
        recipe: 'html',
        engine: 'handlebars'
      },
      data: {
        foo: 'foo'
      }
    })

    res.content.toString().should.be.eql('foo')

    logs.should.matchAny(new RegExp(`No docker container previously assigned, searching by LRU`))
    logs.should.matchAny(new RegExp(`LRU container is ${container.id}`))
  })

  it('should reuse same worker in multiple tasks for same request', async () => {
    reporter.dockerManager.containersManager.containers[0].lastUsed = new Date(1)
    reporter.dockerManager.containersManager.containers[1].lastUsed = new Date(2)
    await reporter.render({
      template: {
        content: '{{foo}}',
        recipe: 'chrome-pdf',
        engine: 'handlebars',
        chrome: { headerTemplate: 'header' }
      },
      data: {
        foo: 'foo'
      }
    })

    should(
      reporter.dockerManager.containersManager.containers[0].lastUsed >
      reporter.dockerManager.containersManager.containers[1].lastUsed
    ).be.true()
  })

  it('should set tenant to worker ip', async () => {
    const res = await reporter.render({
      template: {
        content: '{{foo}}',
        recipe: 'html',
        engine: 'handlebars'
      },
      data: {
        foo: 'foo'
      }
    })

    res.content.toString().should.be.eql('foo')

    const tenantWorker = await reporter.documentStore.internalCollection('tenantWorkers').findOne({
      tenant: testTenant,
      stack: reporter.options.stack
    })

    should(tenantWorker).be.ok()
    tenantWorker.ip.should.be.eql(reporter.options.ip)
  })

  it('should unset old tenant worker ip', async () => {
    await reporter.render({
      template: {
        content: '{{foo}}',
        recipe: 'html',
        engine: 'handlebars'
      },
      data: {
        foo: 'foo'
      },
      context: {
        tenant: testTenant
      }
    })

    let tenantWorker = await reporter.documentStore.internalCollection('tenantWorkers').findOne({
      tenant: testTenant,
      stack: reporter.options.stack
    })

    should(tenantWorker).be.ok()
    tenantWorker.ip.should.be.eql(reporter.options.ip)

    await reporter.render({
      template: {
        content: '{{bar}}',
        recipe: 'html',
        engine: 'handlebars'
      },
      data: {
        bar: 'bar'
      },
      context: {
        tenant: '2'
      }
    })

    await new Promise((resolve) => {
      setTimeout(resolve, 1000)
    })

    tenantWorker = await reporter.documentStore.internalCollection('tenantWorkers').findOne({
      tenant: testTenant,
      stack: reporter.options.stack
    })

    should(tenantWorker).be.not.ok()
  })

  it('should run two parallel requests for tenant', () => {
    return Promise.all([
      reporter.render({
        template: {
          content: '{{foo}}',
          recipe: 'html',
          engine: 'handlebars'
        },
        data: {
          foo: 'foo'
        },
        context: {
          tenant: '1'
        }
      }),
      reporter.render({
        template: {
          content: '{{foo}}',
          recipe: 'html',
          engine: 'handlebars'
        },
        data: {
          foo: 'foo'
        },
        context: {
          tenant: '1'
        }
      })
    ])
  })

  it('should queue request when all workers are busy', async () => {
    await Promise.all([
      reporter.render({
        template: {
          content: '{{foo}}',
          recipe: 'html',
          engine: 'handlebars'
        },
        data: {
          foo: 'foo'
        },
        context: {
          tenant: '1'
        }
      }),
      reporter.render({
        template: {
          content: '{{foo}}',
          recipe: 'html',
          engine: 'handlebars'
        },
        data: {
          foo: 'foo'
        },
        context: {
          tenant: '2'
        }
      }),
      reporter.render({
        template: {
          content: '{{foo}}',
          recipe: 'html',
          engine: 'handlebars'
        },
        data: {
          foo: 'foo'
        },
        context: {
          tenant: '3'
        }
      })
    ])

    logs.should.matchAny(new RegExp(`All docker containers are busy, queuing work`))
  })

  it('should restart worker before switching from other tenant', async () => {
    reporter.dockerManager.containersManager.containers.forEach((c, index) => {
      c.tenant = `usedTenant${index + 1}`
    })

    await reporter.render({
      template: {
        content: '{{foo}}',
        recipe: 'html',
        engine: 'handlebars'
      },
      data: {
        foo: 'foo'
      }
    })

    reporter.dockerManager.containersManager.containers[0].numberOfRestarts.should.be.eql(1)
  })

  it('should restart last used worker after process', async () => {
    await Promise.all([
      reporter.render({
        template: {
          content: '{{foo}}',
          recipe: 'html',
          engine: 'handlebars'
        },
        data: {
          foo: 'foo'
        },
        context: {
          tenant: testTenant
        }
      }),
      reporter.render({
        template: {
          content: '{{bar}}',
          recipe: 'html',
          engine: 'handlebars'
        },
        data: {
          bar: 'bar'
        },
        context: {
          tenant: '2'
        }
      })
    ])

    await new Promise((resolve) => {
      setTimeout(resolve, 1000)
    })

    reporter.dockerManager.containersManager.containers[0].numberOfRestarts = 1
  })

  it('should not be able to communicate with other container using host ip', async function () {
    if (!IS_LINUX) {
      console.log('not running "communicate with other container using host ip" test because os is not linux')
      await reporter.close()
      return
    }

    if (hostIp == null) {
      // skip for now on travis
      console.log('not running "communicate with other container using host ip" test because process.env.hostIp not set')
      await reporter.close()
      return
    }

    const container = reporter.dockerManager.containersManager.containers[1]

    try {
      await reporter.render({
        template: {
          content: 'Request {{bar}}',
          recipe: 'html',
          engine: 'handlebars',
          scripts: [{
            content: `
              const ip = "${hostIp}"
              const targetPort = ${container.port}
              const http = require('http')

              function beforeRender(req, res, done) {
                const target = 'http://' + ip + ':' + targetPort
                console.log('doing request to other worker ' + target + ' from script')

                http.get(target, (res) => {
                  const { statusCode } = res

                  if (statusCode !== 200) {
                    console.log('request to ' + target + ' ended with erro, status ' + statusCode)
                    done()
                  } else {
                    console.log('request to ' + target + ' was good')

                    res.setEncoding('utf8');
                    let rawData = '';

                    res.on('data', (chunk) => { rawData += chunk; })

                    res.on('end', () => {
                      console.log('request to ' + target + ' body response: ' + rawData)
                      done()
                    })
                  }
                }).on('error', (err) => {
                  done(err)
                })
              }
            `
          }]
        },
        data: {
          bar: 'bar'
        }
      })

      throw new Error('it was supposed to fail and not be able to communicate with other container, please check that you have setup iptables rules first')
    } catch (e) {
      e.message.should.match(/connect ECONNREFUSED/)
    }
  })
})

remoteWorkerTests('docker with remote worker', '127.0.0.1')

remoteWorkerTests('docker with remote worker (auth enabled)', '127.0.0.1', true)

function remoteWorkerTests (title, remoteIp, authEnabled = false) {
  let reporter
  let remoteReporter
  let logs = []

  describe(title, async () => {
    const sharedDataDirectory = path.join(__dirname, 'temp')

    beforeEach(async () => {
      logs = []

      try {
        utils.removeDir(sharedDataDirectory)
      } catch (e) {}

      reporter = createReporterInstance({
        store: {
          provider: 'fs'
        },
        extensions: {
          'fs-store': {
            dataDirectory: sharedDataDirectory,
            syncModifications: false
          }
        }
      }, authEnabled)

      await reporter.init()

      addLogsRewriter(reporter, logs)

      remoteReporter = createReporterInstance({
        httpPort: 5489,
        ip: remoteIp,
        store: {
          provider: 'fs'
        },
        extensions: {
          'fs-store': {
            dataDirectory: sharedDataDirectory,
            syncModifications: false
          },
          'docker-workers': {
            container: {
              namePrefix: 'remote_jsreport_worker',
              basePublishPort: 4001
            }
          }
        }
      }, authEnabled)

      await remoteReporter.init()

      await reporter.documentStore.internalCollection('servers').update({
        ip: remoteIp,
        stack: reporter.options.stack
      }, {
        $set: {
          ip: remoteIp,
          ping: new Date(),
          stack: reporter.options.stack
        }
      }, { upsert: true })

      await reporter.dockerManager.serversChecker.refreshServersCache()
      await remoteReporter.dockerManager.serversChecker.refreshServersCache()
    })

    afterEach(async () => {
      if (reporter) {
        await reporter.close()
      }

      if (remoteReporter) {
        await remoteReporter.close()
      }
    })

    it('should proxy request when tenant has active worker', async () => {
      await reporter.documentStore.internalCollection('tenantWorkers').insert({
        ip: remoteIp,
        port: 5489,
        stack: reporter.options.stack,
        tenant: testTenant,
        updateAt: new Date()
      })

      const res = await reporter.render({
        template: {
          content: '{{foo}}',
          recipe: 'chrome-pdf',
          engine: 'handlebars'
        },
        data: {
          foo: 'foo'
        }
      })

      const parsed = await parsePdf(res.content)

      parsed.pages[0].text.should.be.eql('foo')

      logs.should.matchAny(new RegExp(`Delegating script to external worker at http://${remoteIp}:5489`))
      logs.should.matchAny(new RegExp(`Delegating recipe chrome-pdf to external worker at http://${remoteIp}:5489`))
    })

    it('should process request when tenant has worker assigned but it is not active', async () => {
      await reporter.documentStore.internalCollection('tenantWorkers').insert({
        ip: remoteIp,
        port: 5489,
        stack: reporter.options.stack,
        tenant: testTenant,
        updateAt: new Date()
      })

      reporter.dockerManager.serversChecker.stopPingInterval()
      remoteReporter.dockerManager.serversChecker.stopPingInterval()

      await reporter.documentStore.internalCollection('servers').update({
        ip: remoteIp,
        stack: reporter.options.stack
      }, {
        $set: {
          // makes the server to fail the status check
          ping: new Date(Date.now() - 300000)
        }
      })

      await reporter.dockerManager.serversChecker.refreshServersCache()

      const res = await reporter.render({
        template: {
          content: '{{foo}}',
          recipe: 'chrome-pdf',
          engine: 'handlebars'
        },
        data: {
          foo: 'foo'
        }
      })

      const parsed = await parsePdf(res.content)

      parsed.pages[0].text.should.be.eql('foo')

      logs.should.matchAny(new RegExp(`Remote worker .* is not healthy, continuing request in local`))
      logs.should.matchAny(new RegExp(`Delegating script to container in local worker`))
      logs.should.matchAny(new RegExp(`Delegating recipe chrome-pdf to container in local worker`))
    })
  })
}
