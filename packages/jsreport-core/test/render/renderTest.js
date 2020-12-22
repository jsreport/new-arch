const should = require('should')
const core = require('../../index')

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

    reporter.use({
      name: 'render-testing',
      directory: __dirname,
      main: 'renderExtMain.js',
      worker: 'renderExtWorker.js'
    })

    await reporter.init()
  })

  afterEach(async () => {
    if (reporter) {
      await reporter.close()
    }
  })

  it('should initialize data', async () => {
    const functions = {
      beforeRender: ((req) => {
        req.context.baseData = Object.assign({}, req.data)
      }).toString(),
      afterRender: ((req, res) => {
        res.content = Buffer.from(JSON.stringify({
          originalInputDataIsEmpty: req.context.originalInputDataIsEmpty,
          baseData: req.context.baseData
        }))
      }).toString()
    }

    const res = await reporter.render({
      template: {
        engine: 'none',
        content: JSON.stringify(functions),
        recipe: 'html'
      }
    })

    const result = JSON.parse(res.content.toString())

    should(result.originalInputDataIsEmpty).be.eql(true)
    should(result.baseData).be.eql({})
  })

  it('should take data', async () => {
    const functions = {
      beforeRender: ((req) => {
        req.context.baseData = Object.assign({}, req.data)
      }).toString(),
      afterRender: ((req, res) => {
        res.content = Buffer.from(JSON.stringify({
          data: req.context.baseData
        }))
      }).toString()
    }

    const res = await reporter.render({
      template: {
        engine: 'none',
        content: JSON.stringify(functions),
        recipe: 'html'
      },
      data: {
        a: 'a'
      }
    })

    const result = JSON.parse(res.content.toString())

    should(result.data).be.eql({ a: 'a' })
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

  it('should not change input data type', async () => {
    const functions = {
      beforeRender: ((req) => {
        req.context.dataWasArray = Array.isArray(req.data)
        req.data = {}
      }).toString(),
      afterRender: ((req, res) => {
        res.content = Buffer.from(JSON.stringify({
          dataWasArray: req.context.dataWasArray
        }))
      }).toString()
    }

    const res = await reporter.render({
      template: {
        engine: 'none',
        content: JSON.stringify(functions),
        recipe: 'html'
      },
      data: [{ name: 'item1' }, { name: 'item2' }]
    })

    const result = JSON.parse(res.content.toString())

    should(result.dataWasArray).be.true()
  })

  it('should validate and coerce template input according to template type schema', async () => {
    const functions = {
      afterRender: ((req, res) => {
        res.content = Buffer.from(JSON.stringify({
          request: req
        }))
      }).toString()
    }

    const res = await reporter.render({
      template: {
        engine: 'none',
        content: JSON.stringify(functions),
        recipe: 'html',
        chrome: {
          printBackground: 'true',
          timeout: '10000'
        }
      }
    })

    const result = JSON.parse(res.content.toString())

    should(result.request.template.engine).be.eql('none')
    should(result.request.template.chrome.printBackground).be.true()
    should(result.request.template.chrome.timeout).be.eql(10000)
  })

  it('should fail validation of template input according to template type schema', async () => {
    const functions = {
      afterRender: ((req, res) => {
        res.content = Buffer.from(JSON.stringify({
          request: req
        }))
      }).toString()
    }

    return should(reporter.render({
      template: {
        engine: 'none',
        content: JSON.stringify(functions),
        recipe: 'html',
        chrome: {
          printBackground: 3000,
          timeout: 'invalid'
        }
      }
    })).be.rejectedWith(/does not match the defined schema/)
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
    const functions = {
      beforeRender: ((req) => {
        req.context.listenersCall = ['before']
      }).toString(),
      validateRender: ((req) => {
        req.context.listenersCall.push('validateRender')
      }).toString(),
      afterTemplatingEnginesExecuted: ((req) => {
        req.context.listenersCall.push('afterTemplatingEnginesExecuted')
      }).toString(),
      afterRender: ((req, res) => {
        req.context.listenersCall.push('after')

        res.content = Buffer.from(JSON.stringify({
          listenersCall: req.context.listenersCall
        }))
      }).toString()
    }

    const res = await reporter.render({
      template: {
        engine: 'none',
        content: JSON.stringify(functions),
        recipe: 'html'
      }
    })

    const result = JSON.parse(res.content.toString())

    should(result.listenersCall).have.length(4)
    should(result.listenersCall[0]).be.eql('before')
    should(result.listenersCall[1]).be.eql('validateRender')
    should(result.listenersCall[2]).be.eql('afterTemplatingEnginesExecuted')
    should(result.listenersCall[3]).be.eql('after')
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
    const functions = {
      beforeRender: ((req, res, reporter) => {
        reporter.logger.debug('foo', req)
      }).toString()
    }

    const res = await reporter.render({
      template: {
        engine: 'none',
        content: JSON.stringify(functions),
        recipe: 'html'
      }
    })

    should(res.meta.logs.find((l) => l.message === 'foo')).be.ok()
  })

  it('should propagate logs to the parent request', async () => {
    const functions = {
      beforeRender: (async (req, res, reporter) => {
        reporter.logger.debug('hello', req)

        await reporter.render({
          context: {
            skipRenderExt: true
          },
          template: {
            content: 'foo',
            engine: 'none',
            recipe: 'html'
          }
        }, req)
      }).toString()
    }

    const res = await reporter.render({
      template: {
        content: JSON.stringify(functions),
        engine: 'none',
        recipe: 'html'
      }
    })

    const logs = res.meta.logs.map(l => l.message)

    logs.should.containEql('hello')
    logs.should.matchAny((l) => l.should.startWith('Starting rendering request 2'))
  })

  it('should propagate logs to the parent request (error case)', async () => {
    const functions = {
      beforeRender: (async (req, res, reporter) => {
        reporter.logger.debug('hello', req)

        const childFunctions = {
          afterRender: (() => {
            throw new Error('intentional error')
          }).toString()
        }

        try {
          await reporter.render({
            template: {
              content: JSON.stringify(childFunctions),
              engine: 'none',
              recipe: 'html'
            }
          }, req)
        } catch (e) {
          req.context.childRequestFailed = true
        }
      }).toString(),
      afterRender: ((req, res) => {
        res.content = Buffer.from(JSON.stringify({
          childRequestFailed: req.context.childRequestFailed
        }))
      }).toString()
    }

    const res = await reporter.render({
      template: {
        content: JSON.stringify(functions),
        engine: 'none',
        recipe: 'html'
      }
    })

    const result = JSON.parse(res.content.toString())

    should(result.childRequestFailed).be.true()

    const logs = res.meta.logs.map(l => l.message)

    logs.should.containEql('hello')
    logs.should.matchAny((l) => l.should.startWith('Starting rendering request 2'))
    logs.should.matchAny((l) => l.should.containEql('intentional error'))
  })

  it('should propagate context.shared to the parent request', async () => {
    const functions = {
      beforeRender: (async (req, res, reporter) => {
        const childFunctions = {
          beforeRender: ((req) => {
            req.context.shared.array.push(2)
          }).toString(),
          afterRender: ((req) => {
            req.context.shared.array.push(3)
          }).toString()
        }

        await reporter.render({
          template: {
            content: JSON.stringify(childFunctions),
            engine: 'none',
            recipe: 'html'
          }
        }, req)
      }).toString(),
      afterRender: ((req, res) => {
        res.content = Buffer.from(JSON.stringify({
          shared: req.context.shared
        }))
      }).toString()
    }

    const res = await reporter.render({
      context: {
        shared: { array: [1] }
      },
      template: {
        content: JSON.stringify(functions),
        engine: 'none',
        recipe: 'html'
      }
    })

    const result = JSON.parse(res.content.toString())

    should(result.shared.array).be.eql([1, 2, 3])
  })

  it('should add isChildRequest to the nested render', async () => {
    const functions = {
      beforeRender: (async (req, res, reporter) => {
        const childFunctions = {
          afterRender: ((req, res) => {
            res.content = Buffer.from(JSON.stringify({
              isChildRequest: req.context.isChildRequest
            }))
          }).toString()
        }

        const renderResult = await reporter.render({
          template: {
            content: JSON.stringify(childFunctions),
            engine: 'none',
            recipe: 'html'
          }
        }, req)

        req.context.childRequestResult = JSON.parse(renderResult.content.toString())
      }).toString(),
      afterRender: ((req, res) => {
        res.content = Buffer.from(JSON.stringify({
          isChildRequest: req.context.isChildRequest,
          child: req.context.childRequestResult
        }))
      }).toString()
    }

    const res = await reporter.render({
      template: {
        content: JSON.stringify(functions),
        engine: 'none',
        recipe: 'html'
      }
    })

    const result = JSON.parse(res.content.toString())

    should(result.isChildRequest).not.be.true()
    should(result.child.isChildRequest).be.true()
  })

  it('should detect initial data on current request correctly', async () => {
    const functions = {
      beforeRender: (async (req, res, reporter) => {
        const childFunctions = {
          afterRender: ((req, res) => {
            res.content = Buffer.from(JSON.stringify({
              data: req.data,
              originalInputDataIsEmpty: req.context.originalInputDataIsEmpty
            }))
          }).toString()
        }

        const renderResult = await reporter.render({
          template: {
            content: JSON.stringify(childFunctions),
            engine: 'none',
            recipe: 'html'
          },
          data: { a: 'a' }
        }, req)

        req.context.childRequestResult = JSON.parse(renderResult.content.toString())
      }).toString(),
      afterRender: ((req, res) => {
        res.content = Buffer.from(JSON.stringify({
          originalInputDataIsEmpty: req.context.originalInputDataIsEmpty,
          child: req.context.childRequestResult
        }))
      }).toString()
    }

    const res = await reporter.render({
      template: {
        content: JSON.stringify(functions),
        engine: 'none',
        recipe: 'html'
      }
    })

    const result = JSON.parse(res.content.toString())

    should(result.originalInputDataIsEmpty).be.true()
    should(result.child.originalInputDataIsEmpty).be.not.true()
    should(result.child.data).have.property('a')
  })

  it('should inherit parent data to the current request', async () => {
    const functions = {
      beforeRender: (async (req, res, reporter) => {
        const childFunctions = {
          afterRender: ((req, res) => {
            res.content = Buffer.from(JSON.stringify({
              data: req.data,
              options: req.options,
              originalInputDataIsEmpty: req.context.originalInputDataIsEmpty
            }))
          }).toString()
        }

        const renderResult = await reporter.render({
          template: {
            content: JSON.stringify(childFunctions),
            engine: 'none',
            recipe: 'html'
          },
          options: { b: 'b', c: 'x' }
        }, req)

        req.context.childRequestResult = JSON.parse(renderResult.content.toString())
      }).toString(),
      afterRender: ((req, res) => {
        res.content = Buffer.from(JSON.stringify({
          originalInputDataIsEmpty: req.context.originalInputDataIsEmpty,
          child: req.context.childRequestResult
        }))
      }).toString()
    }

    const res = await reporter.render({
      template: {
        content: JSON.stringify(functions),
        engine: 'none',
        recipe: 'html'
      },
      data: { a: 'a' },
      options: { a: 'a', c: 'c' }
    })

    const result = JSON.parse(res.content.toString())

    should(result.originalInputDataIsEmpty).be.not.true()
    should(result.child.originalInputDataIsEmpty).be.not.true()
    should(result.child.data).have.property('a')
    should(result.child.options).have.property('a')
    should(result.child.options).have.property('b')
    should(result.child.options).have.property('c')
    should(result.child.options.c).be.eql('x')
  })

  it('should merge parent to the current request', async () => {
    const functions = {
      beforeRender: (async (req, res, reporter) => {
        const childFunctions = {
          afterRender: ((req, res) => {
            res.content = Buffer.from(JSON.stringify({
              data: req.data,
              options: req.options,
              originalInputDataIsEmpty: req.context.originalInputDataIsEmpty
            }))
          }).toString()
        }

        const renderResult = await reporter.render({
          template: {
            content: JSON.stringify(childFunctions),
            engine: 'none',
            recipe: 'html'
          },
          data: { b: 'b' },
          options: { b: 'b', c: 'x' }
        }, req)

        req.context.childRequestResult = JSON.parse(renderResult.content.toString())
      }).toString(),
      afterRender: ((req, res) => {
        res.content = Buffer.from(JSON.stringify({
          originalInputDataIsEmpty: req.context.originalInputDataIsEmpty,
          child: req.context.childRequestResult
        }))
      }).toString()
    }

    const res = await reporter.render({
      template: {
        content: JSON.stringify(functions),
        engine: 'none',
        recipe: 'html'
      },
      data: { a: 'a' },
      options: { a: 'a', c: 'c' }
    })

    const result = JSON.parse(res.content.toString())

    should(result.originalInputDataIsEmpty).be.not.true()
    should(result.child.originalInputDataIsEmpty).be.not.true()
    should(result.child.data).have.property('a')
    should(result.child.options).have.property('a')
    should(result.child.options).have.property('b')
    should(result.child.options).have.property('c')
    should(result.child.options.c).be.eql('x')
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

    reporter.use({
      name: 'render-testing',
      directory: __dirname,
      main: 'renderExtMain.js',
      worker: 'renderExtWorker.js'
    })

    return reporter.init()
  })

  afterEach(() => {
    if (reporter) {
      return reporter.close()
    }
  })

  it('should timeout', async () => {
    const functions = {
      beforeRender: (async (req, res, reporter) => {
        await new Promise((resolve) => setTimeout(resolve, reporter.options.reportTimeout + 10))
      }).toString()
    }

    return should(reporter.render({
      template: {
        engine: 'none',
        content: JSON.stringify(functions),
        recipe: 'html'
      },
      options: renderOpts
    })).be.rejectedWith(/Report timeout/)
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
    const functions = {
      beforeRender: (async (req, res, reporter) => {
        const childFunctions = {
          beforeRender: (async (req, res, reporter) => {
            await new Promise((resolve) => setTimeout(resolve, reporter.options.reportTimeout + 10))
          }).toString()
        }

        await reporter.render({
          template: {
            content: JSON.stringify(childFunctions),
            engine: 'none',
            recipe: 'html'
          }
        }, req)
      }).toString()
    }

    return should(reporter.render({
      template: {
        engine: 'none',
        content: JSON.stringify(functions),
        recipe: 'html'
      },
      options: renderOpts
    })).be.rejectedWith(/Report timeout/)
  })
}
