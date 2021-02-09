require('should')
const jsreport = require('../../index')

describe('sandbox', () => {
  let reporter

  beforeEach(async () => {
    reporter = jsreport()
    reporter.use(jsreport.tests.listeners())

    await reporter.init()
  })

  afterEach(async () => {
    if (reporter) {
      await reporter.close()
    }
  })

  it('should be able to read normal sandbox props', async () => {
    reporter.tests.afterRenderEval(async (req, res, { reporter }) => {
      const r = await reporter.runInSandbox({
        context: {
          a: 'foo'
        },
        userCode: '',
        executionFn: ({ context }) => {
          return `${context.a}_end`
        }
      }, req)
      res.content = Buffer.from(r)
    })

    const res = await reporter.render({
      template: {
        engine: 'none',
        content: ' ',
        recipe: 'html'
      }
    })
    res.content.toString().should.be.eql('foo_end')
  })

  it('should be able to set normal sandbox props', async () => {
    reporter.tests.afterRenderEval(async (req, res, { reporter }) => {
      const r = await reporter.runInSandbox({
        context: {
          a: 'foo'
        },
        userCode: 'a = \'value\'',
        executionFn: ({ context }) => {
          return context.a
        }
      }, req)
      res.content = Buffer.from(r)
    })

    const res = await reporter.render({
      template: {
        engine: 'none',
        content: ' ',
        recipe: 'html'
      }
    })
    res.content.toString().should.be.eql('value')
  })

  it('should be able to set normal nested sandbox props', async () => {
    reporter.tests.afterRenderEval(async (req, res, { reporter }) => {
      const r = await reporter.runInSandbox({
        context: {
          a: {
            b: 'a'
          }
        },
        userCode: "a.b = 'x';",
        executionFn: ({ context }) => {
          return context.a.b
        }
      }, req)
      res.content = Buffer.from(r)
    })

    const res = await reporter.render({
      template: {
        engine: 'none',
        content: ' ',
        recipe: 'html'
      }
    })

    res.content.toString().should.be.eql('x')
  })

  it('should be able to set props with sandboxReadOnly=false', async () => {
    reporter.tests.afterRenderEval(async (req, res, { reporter }) => {
      const r = await reporter.runInSandbox({
        context: {
          a: 'a'
        },
        userCode: "a = 'x';",
        executionFn: ({ context }) => {
          return context.a
        },
        propertiesConfig: {
          a: {
            sandboxReadOnly: false
          }
        }
      }, req)
      res.content = Buffer.from(r)
    })

    const res = await reporter.render({
      template: {
        engine: 'none',
        content: ' ',
        recipe: 'html'
      }
    })

    res.content.toString().should.be.eql('x')
  })

  it('should hide simple props', async () => {
    reporter.tests.afterRenderEval(async (req, res, { reporter }) => {
      const r = await reporter.runInSandbox({
        context: {
          a: 'foo'
        },
        userCode: 'this.b = typeof a',
        executionFn: ({ context }) => {
          return context.b
        },
        propertiesConfig: {
          a: {
            sandboxHidden: true
          }
        }
      }, req)
      res.content = Buffer.from(r)
    })

    const res = await reporter.render({
      template: {
        engine: 'none',
        content: ' ',
        recipe: 'html'
      }
    })

    res.content.toString().should.be.eql('undefined')
  })

  it('should hide nested props', async () => {
    reporter.tests.afterRenderEval(async (req, res, { reporter }) => {
      const r = await reporter.runInSandbox({
        context: {
          a: { b: 'foo' }
        },
        userCode: 'this.b = typeof a.b',
        executionFn: ({ context }) => {
          return context.b
        },
        propertiesConfig: {
          'a.b': {
            sandboxHidden: true
          }
        }
      }, req)
      res.content = Buffer.from(r)
    })

    const res = await reporter.render({
      template: {
        engine: 'none',
        content: ' ',
        recipe: 'html'
      }
    })

    res.content.toString().should.be.eql('undefined')
  })

  it('should make simple props readonly', async () => {
    reporter.tests.afterRenderEval(async (req, res, { reporter }) => {
      const r = await reporter.runInSandbox({
        context: {
          a: { b: 'foo' }
        },
        userCode: 'a.b = "change"',
        executionFn: ({ context }) => {
          return context.a.b
        },
        propertiesConfig: {
          'a.b': {
            sandboxReadOnly: true
          }
        }
      }, req)
      res.content = Buffer.from(r)
    })

    return reporter.render({
      template: {
        engine: 'none',
        content: ' ',
        recipe: 'html'
      }
    }).should.be.rejectedWith(/Can't modify read only property/)
  })

  it('should make props readonly one level recursively', async () => {
    reporter.tests.afterRenderEval(async (req, res, { reporter }) => {
      const r = await reporter.runInSandbox({
        context: {
          a: { b: { c: 'foo' } }
        },
        userCode: 'a.b.c = "change"',
        executionFn: ({ context }) => {
          return context.a.b
        },
        propertiesConfig: {
          'a.b': {
            sandboxReadOnly: true
          }
        }
      }, req)
      res.content = Buffer.from(r)
    })

    return reporter.render({
      template: {
        engine: 'none',
        content: ' ',
        recipe: 'html'
      }
    }).should.be.rejectedWith(/Can't add or modify/)
  })

  it('should allow configure top level and inner level properties at the same time', async () => {
    reporter.tests.afterRenderEval(async (req, res, { reporter }) => {
      const r = await reporter.runInSandbox({
        context: {
          a: { b: { c: 'foo' } }
        },
        userCode: 'b = typeof a.b.c',
        executionFn: ({ context }) => {
          return context.b
        },
        propertiesConfig: {
          'a.b': {
            sandboxReadOnly: true
          },
          'a.b.c': {
            sandboxHidden: true
          }
        }
      }, req)
      res.content = Buffer.from(r)
    })

    const res = await reporter.render({
      template: {
        engine: 'none',
        content: ' ',
        recipe: 'html'
      }
    })
    res.content.toString().should.be.eql('undefined')

    reporter.tests.afterRenderEval(async (req, res, { reporter }) => {
      const r = await reporter.runInSandbox({
        context: {
          a: { b: { c: 'foo' } }
        },
        userCode: 'a.b.c = "change"',
        executionFn: ({ context }) => {
          return context.b
        },
        propertiesConfig: {
          'a.b': {
            sandboxReadOnly: true
          },
          'a.b.c': {
            sandboxHidden: true
          }
        }
      }, req)
      res.content = Buffer.from(r)
    })

    return reporter.render({
      template: {
        engine: 'none',
        content: ' ',
        recipe: 'html'
      }
    }).should.be.rejectedWith(/Can't add or modify/)
  })

  it('should not fail when configuring top level and inner level properties but parent value is empty', async () => {
    reporter.tests.afterRenderEval(async (req, res, { reporter }) => {
      const r = await reporter.runInSandbox({
        context: {
          a: {}
        },
        userCode: '',
        executionFn: ({ context }) => {
          return typeof context.a
        },
        propertiesConfig: {
          'a.b': {
            sandboxReadOnly: true
          },
          'a.b.c': {
            sandboxHidden: true
          }
        }
      }, req)
      res.content = Buffer.from(r)
    })

    const res = await reporter.render({
      template: {
        engine: 'none',
        content: ' ',
        recipe: 'html'
      }
    })
    res.content.toString().should.be.eql('object')
  })

  it('restore should reveal hidden props', async () => {
    reporter.tests.afterRenderEval(async (req, res, { reporter }) => {
      const r = await reporter.runInSandbox({
        context: {
          a: { b: 'foo' }
        },
        userCode: '',
        executionFn: ({ context, restore }) => {
          const beforeRestore = typeof context.a.b
          const restoredContext = restore()
          const afterRestore = typeof restoredContext.a.b

          return beforeRestore + afterRestore
        },
        propertiesConfig: {
          'a.b': {
            sandboxHidden: true
          }
        }
      }, req)
      res.content = Buffer.from(r)
    })

    const res = await reporter.render({
      template: {
        engine: 'none',
        content: ' ',
        recipe: 'html'
      }
    })
    res.content.toString().should.be.eql('undefinedstring')
  })

  it('be able to stringify object when non-existent properties are configured', async () => {
    reporter.tests.afterRenderEval(async (req, res, { reporter }) => {
      const r = await reporter.runInSandbox({
        context: {
          a: { b: 'foo' }
        },
        userCode: '',
        executionFn: ({ context }) => {
          return JSON.stringify(context)
        },
        propertiesConfig: {
          'a.d': {
            sandboxHidden: true
          },
          'a.c': {
            sandboxReadOnly: true
          }
        }
      }, req)
      res.content = Buffer.from(r)
    })

    const res = await reporter.render({
      template: {
        engine: 'none',
        content: ' ',
        recipe: 'html'
      }
    })
    res.content.toString().should.containEql('foo')
  })

  it('should prevent constructor hacks', async () => {
    reporter.tests.afterRenderEval(async (req, res, { reporter }) => {
      const r = await reporter.runInSandbox({
        context: {},
        userCode: 'this.constructor.constructor(\'return process\')().exit()',
        executionFn: ({ context }) => {
          return JSON.stringify(context)
        },
        propertiesConfig: {
          'a.d': {
            sandboxHidden: true
          },
          'a.c': {
            sandboxReadOnly: true
          }
        }
      }, req)
      res.content = Buffer.from(r)
    })

    return reporter.render({
      template: {
        engine: 'none',
        content: ' ',
        recipe: 'html'
      }
    }).should.be.rejectedWith(/process is not defined/)
  })

  it('should allow top level await in sandbox eval', async () => {
    reporter.tests.afterRenderEval(async (req, res, { reporter }) => {
      const r = await reporter.runInSandbox({
        context: {},
        userCode: 'await new Promise((resolve) => resolve()); a = "foo"',
        executionFn: ({ context }) => {
          return context.a
        }
      }, req)
      res.content = Buffer.from(r)
    })

    const res = await reporter.render({
      template: {
        engine: 'none',
        content: ' ',
        recipe: 'html'
      }
    })
    res.content.toString().should.be.eql('foo')
  })
})
