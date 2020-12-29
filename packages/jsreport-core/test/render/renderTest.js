const should = require('should')
const core = require('../../index')
const createRequest = require('../../lib/shared/request')

describe('render', () => {
  let reporter

  beforeEach(async () => {
    reporter = core({ discover: false })

    reporter.use({
      name: 'test',
      main: (reporter, definition) => {
        reporter.documentStore.registerComplexType('ChromeType', {
          printBackground: { type: 'Edm.Boolean' },
          timeout: { type: 'Edm.Int32' }
        })

        reporter.documentStore.model.entityTypes.TemplateType.chrome = { type: 'jsreport.ChromeType' }
      }
    })

    reporter.use(core.tests.listenersExtension)
    await reporter.init()
  })

  afterEach(async () => {
    if (reporter) {
      await reporter.close()
    }
  })

  it('should initialize data', async () => {
    let context
    let data

    reporter.beforeRenderListeners.add('test', (req) => {
      context = req.context
      data = req.data
    })

    await reporter.render({
      template: {
        engine: 'none',
        content: 'foo',
        recipe: 'html'
      }
    })

    context.originalInputDataIsEmpty.should.be.eql(true)
    data.should.be.eql({})
  })

  it('should take data', async () => {
    let context
    let data

    reporter.beforeRenderListeners.add('test', (req) => {
      context = req.context
      data = req.data
    })

    await reporter.render({
      template: {
        engine: 'none',
        content: 'foo',
        recipe: 'html'
      },
      data: { a: 'a' }
    })

    context.originalInputDataIsEmpty.should.be.eql(false)
    data.should.be.eql({ a: 'a' })
  })

  it('should not be able to pass data as array', async () => {
    return should(reporter.render({
      template: {
        engine: 'none',
        content: '{}',
        recipe: 'html'
      },
      data: [{ name: 'item1' }, { name: 'item2' }]
    })).be.rejectedWith(/^Request data can not be an array/)
  })

  it('should validate and coerce template input according to template type schema', async () => {
    let request

    reporter.beforeRenderListeners.add('test', (req) => {
      request = req
    })

    await reporter.render({
      template: {
        engine: 'none',
        content: 'foo',
        recipe: 'html',
        chrome: {
          printBackground: 'true',
          timeout: '10000'
        }
      }
    })

    request.template.engine.should.be.eql('none')
    request.template.chrome.printBackground.should.be.true()
    request.template.chrome.timeout.should.be.eql(10000)
  })

  it('should fail validation of template input according to template type schema', async () => {
    return reporter.render({
      template: {
        engine: 'none',
        content: 'foo',
        recipe: 'html',
        chrome: {
          printBackground: 3000,
          timeout: 'invalid'
        }
      }
    }).should.be.rejectedWith(/does not match the defined schema/)
  })

  it('should render simple none engine for html recipe', async () => {
    const response = await reporter.render({
      context: {
        skipRenderExt: true
      },
      template: {
        content: 'foo',
        engine: 'none',
        recipe: 'html'
      }
    })

    should(response.content.toString()).be.eql('foo')
  })

  it('should fail when req.template.recipe not specified', async () => {
    return should(reporter.render({
      context: {
        skipRenderExt: true
      },
      template: {
        content: 'foo2',
        engine: 'none'
      }
    })).be.rejectedWith(/Recipe/)
  })

  it('should fail when req.template.engine not specified', async () => {
    return should(reporter.render({
      context: {
        skipRenderExt: true
      },
      template: {
        content: 'foo2',
        recipe: 'html'
      }
    })).be.rejectedWith(/Engine/)
  })

  it('should fail when req.template.recipe not found', async () => {
    return should(reporter.render({
      context: {
        skipRenderExt: true
      },
      template: {
        content: 'foo2',
        engine: 'none',
        recipe: 'foo'
      }
    })).be.rejectedWith(/Recipe/)
  })

  it('should fail when req.template.engine not found', async () => {
    return should(reporter.render({
      context: {
        skipRenderExt: true
      },
      template: {
        content: 'foo2',
        engine: 'foo',
        recipe: 'html'
      }
    })).be.rejectedWith(/Engine/)
  })

  it('should call listeners in render', async () => {
    const listenersCall = []

    reporter.beforeRenderListeners.add('test', this, () => listenersCall.push('before'))
    reporter.validateRenderListeners.add('test', this, () => listenersCall.push('validateRender'))
    reporter.afterTemplatingEnginesExecutedListeners.add('test', this, () => listenersCall.push('afterTemplatingEnginesExecuted'))
    reporter.afterRenderListeners.add('test', this, () => listenersCall.push('after'))

    await reporter.render({ template: { content: 'Hey', engine: 'none', recipe: 'html' } })
    listenersCall[0].should.be.eql('before')
    listenersCall[1].should.be.eql('validateRender')
    listenersCall[2].should.be.eql('afterTemplatingEnginesExecuted')
    listenersCall[3].should.be.eql('after')
  })

  it('should call renderErrorListeners', async () => {
    const functions = {
      beforeRender: ((req) => {
        throw new Error('intentional')
      }).toString()
    }

    let loggedError

    reporter.renderErrorListeners.add('test', function (req, res, e) {
      loggedError = e.message
    })

    try {
      await reporter.render({
        template: {
          engine: 'none',
          content: JSON.stringify(functions),
          recipe: 'html'
        }
      })
    } catch (e) {
      loggedError.should.be.eql('intentional')
    }
  })

  it('should allow customize report name', async () => {
    const res = await reporter.render({
      context: {
        skipRenderExt: true
      },
      template: {
        engine: 'none',
        content: 'none',
        recipe: 'html'
      },
      options: { reportName: 'custom-report-name' }
    })

    res.meta.reportName.should.be.eql('custom-report-name')
  })

  it('should provide logs in response meta', async () => {
    const response = await reporter.render({ template: { engine: 'none', content: 'none', recipe: 'html' } })
    response.meta.logs.find((l) => l.message.includes('html')).should.be.ok()
  })

  it('should propagate logs to the parent request', async () => {
    const parentReq = createRequest({
      template: {},
      options: {},
      context: {
        logs: [{ message: 'hello' }]
      }
    })

    await reporter.render({
      template: { content: 'Hey', engine: 'none', recipe: 'html' }
    }, parentReq)

    const logs = parentReq.context.logs.map(l => l.message)

    logs.should.containEql('hello')
  })

  it('should propagate logs to the parent request (error case)', async () => {
    const parentReq = createRequest({
      template: {},
      options: {},
      context: {
        logs: [{ message: 'hello' }]
      }
    })

    reporter.afterRenderListeners.add('test', () => {
      throw new Error('child error')
    })

    try {
      await reporter.render({
        template: { content: 'Hey', engine: 'none', recipe: 'html' }
      }, parentReq)

      throw new Error('render should fail')
    } catch (e) {
      const logs = parentReq.context.logs.map(l => l.message)

      logs.should.containEql('hello')
    }
  })

  // TODO check this
  it.skip('should propagate context.shared to the parent request', async () => {
    reporter.beforeRenderListeners.add('test', (req) => {
      req.context.shared.value += 'before'
      if (req.template.content === 'main') {
        return reporter.render({
          template: {
            content: 'child',
            engine: 'none',
            recipe: 'html'
          }
        }, req)
      }
    })

    reporter.afterRenderListeners.add('test', (req) => {
      req.context.shared.value += 'after'

      if (req.template.content === 'main') {
        req.context.shared.value.should.be.eql('beforebeforeafterafter')
      }
    })

    await reporter.render({
      context: {
        shared: { value: '' }
      },
      template: {
        content: 'main',
        engine: 'none',
        recipe: 'html'
      }
    })
  })

  it('should add isChildRequest to the nested render', async () => {
    let context
    reporter.beforeRenderListeners.add('test', this, (req) => (context = req.context))

    const parentReq = createRequest({
      template: {},
      options: {},
      context: {
        logs: []
      }
    })

    await reporter.render({
      template: { content: 'Hey', engine: 'none', recipe: 'html' }
    }, parentReq)

    context.isChildRequest.should.be.true()
    should(parentReq.context.isChildRequest).not.be.true()
  })

  it('should detect initial data on current request correctly', async () => {
    let data
    let childOriginalInputDataIsEmpty

    reporter.beforeRenderListeners.add('test', this, (req) => {
      data = req.data
      childOriginalInputDataIsEmpty = req.context.originalInputDataIsEmpty
    })

    const parentReq = createRequest({
      template: {},
      options: {},
      context: {
        logs: []
      }
    })

    parentReq.context.originalInputDataIsEmpty.should.be.eql(true)

    await reporter.render({
      template: { content: 'Hey', engine: 'none', recipe: 'html' },
      data: { a: 'a' }
    }, parentReq)

    childOriginalInputDataIsEmpty.should.be.eql(false)
    data.should.have.property('a')
  })

  it('should inherit parent data to the current request', async () => {
    let data
    let options
    let childOriginalInputDataIsEmpty

    reporter.beforeRenderListeners.add('test', this, (req) => {
      childOriginalInputDataIsEmpty = req.context.originalInputDataIsEmpty
      data = req.data
      options = req.options
    })

    const parentReq = createRequest({
      template: {},
      options: { a: 'a', c: 'c' },
      data: { a: 'a' },
      context: {
        logs: []
      }
    })

    parentReq.context.originalInputDataIsEmpty.should.be.eql(false)

    await reporter.render({
      template: { content: 'Hey', engine: 'none', recipe: 'html' },
      options: { b: 'b', c: 'x' }
    }, parentReq)

    childOriginalInputDataIsEmpty.should.be.eql(false)
    data.should.have.property('a')
    options.should.have.property('a')
    options.should.have.property('b')
    options.should.have.property('c')
    options.c.should.be.eql('x')
  })

  it('should merge parent to the current request', async () => {
    let data
    let options
    let childOriginalInputDataIsEmpty

    reporter.beforeRenderListeners.add('test', this, (req) => {
      childOriginalInputDataIsEmpty = req.context.originalInputDataIsEmpty
      data = req.data
      options = req.options
    })

    const parentReq = createRequest({
      template: {},
      options: { a: 'a', c: 'c' },
      data: { a: 'a' },
      context: {
        logs: []
      }
    })

    parentReq.context.originalInputDataIsEmpty.should.be.eql(false)

    await reporter.render({
      template: { content: 'Hey', engine: 'none', recipe: 'html' },
      data: { b: 'b' },
      options: { b: 'b', c: 'x' }
    }, parentReq)

    childOriginalInputDataIsEmpty.should.be.eql(false)
    data.should.have.property('a')
    data.should.have.property('b')
    options.should.have.property('a')
    options.should.have.property('b')
    options.should.have.property('c')
    options.c.should.be.eql('x')
  })
})

describe('render (single timeout)', () => {
  timeoutTests()
})

describe('render (single timeout per request as req.options.timeout)', () => {
  timeoutTests(true)
})

function timeoutTests (asReqOption = false) {
  let reporter
  const reportTimeout = 200
  let renderOpts

  beforeEach(() => {
    const opts = { discover: false }

    if (!asReqOption) {
      opts.reportTimeout = reportTimeout
    } else {
      opts.enableRequestReportTimeout = true
      renderOpts = { timeout: reportTimeout }
    }

    reporter = core(opts)

    reporter.use(core.tests.listenersExtension)
    return reporter.init()
  })

  afterEach(() => {
    if (reporter) {
      return reporter.close()
    }
  })

  it('should timeout', async () => {
    reporter.beforeRenderListeners.add('test', async () => {
      await new Promise((resolve) => setTimeout(resolve, reportTimeout + 10))
    })

    return reporter.render({
      template: {
        engine: 'none',
        content: 'foo',
        recipe: 'html'
      },
      options: renderOpts
    }).should.be.rejectedWith(/Report timeout/)
  })

  it('should timeout with blocking template engine', async () => {
    return should(reporter.render({
      context: {
        skipRenderExt: true
      },
      template: {
        engine: 'none',
        content: 'foo',
        recipe: 'html',
        helpers: 'while (true) {}'
      },
      options: renderOpts
    })).rejectedWith(/Report timeout/)
  })

  it('should timeout with child requests', async () => {
    reporter.beforeRenderListeners.add('test', async (req) => {
      if (req.context.isChildRequest) {
        await new Promise((resolve) => setTimeout(resolve, reportTimeout + 10))
      } else {
        const resp = await reporter.render({
          template: {
            engine: 'none',
            content: 'bar',
            recipe: 'html'
          },
          options: renderOpts
        }, req)

        req.template.content += ` ${resp.content}`
      }
    })

    return reporter.render({
      template: {
        engine: 'none',
        content: 'foo',
        recipe: 'html'
      },
      options: renderOpts
    }).should.be.rejectedWith(/Report timeout/)
  })
}
