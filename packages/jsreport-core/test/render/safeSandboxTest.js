const should = require('should')
const core = require('../../index')

describe('sandbox', () => {
  let reporter

  beforeEach(async () => {
    reporter = core({ discover: false })

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

  it('should be able to read normal sandbox props', async () => {
    const functions = {
      afterRender: (async (req, res, reporter) => {
        const result = await reporter.runInSandbox(({ context }) => {
          return context.done(context.a)
        }, {
          getContext: () => {
            return {
              a: 'foo',
              done: (v) => {
                return `${v}_end`
              }
            }
          }
        })

        res.content = Buffer.from(JSON.stringify({
          sandboxResult: result
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

    should(result.sandboxResult).be.eql('foo_end')
  })

  it('should be able to set normal sandbox props', async () => {
    const functions = {
      afterRender: (async (req, res, reporter) => {
        const result = await reporter.runInSandbox(({ context }) => {
          return context.a
        }, {
          getContext: () => {
            return {
              a: 'foo'
            }
          },
          onEval: async ({ run }) => {
            await run("a = 'x';")
          }
        })

        res.content = Buffer.from(JSON.stringify({
          sandboxResult: result
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

    should(result.sandboxResult).be.eql('x')
  })

  it('should be able to set normal nested sandbox props', async () => {
    const functions = {
      afterRender: (async (req, res, reporter) => {
        const result = await reporter.runInSandbox(({ context }) => {
          return context.a
        }, {
          getContext: () => {
            return {
              a: {
                b: 'a'
              }
            }
          },
          onEval: async ({ run }) => {
            await run("a.b = 'x';")
          }
        })

        res.content = Buffer.from(JSON.stringify({
          sandboxResult: result
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

    should(result.sandboxResult.b).be.eql('x')
  })

  it('should be able to set props with sandboxReadOnly=false', async () => {
    const functions = {
      afterRender: (async (req, res, reporter) => {
        const result = await reporter.runInSandbox(({ context }) => {
          return context.a
        }, {
          getContext: () => {
            return {
              a: 'a'
            }
          },
          onEval: async ({ run }) => {
            await run("a = 'x';")
          },
          propertiesConfig: {
            a: {
              sandboxReadOnly: false
            }
          }
        })

        res.content = Buffer.from(JSON.stringify({
          sandboxResult: result
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

    should(result.sandboxResult).be.eql('x')
  })

  it('should hide simple props', async () => {
    const functions = {
      afterRender: (async (req, res, reporter) => {
        const result = await reporter.runInSandbox(({ context }) => {
          return {
            firstCheck: context.b,
            secondCheck: typeof context.a === 'undefined'
          }
        }, {
          getContext: () => {
            return {
              a: 'foo'
            }
          },
          onEval: async ({ run }) => {
            await run("this.b = typeof a === 'undefined'")
          },
          propertiesConfig: {
            a: {
              sandboxHidden: true
            }
          }
        })

        res.content = Buffer.from(JSON.stringify({
          sandboxResult: result
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

    should(result.sandboxResult.firstCheck).be.true()
    should(result.sandboxResult.secondCheck).be.true()
  })

  it('should hide nested props', async () => {
    const functions = {
      afterRender: (async (req, res, reporter) => {
        const result = await reporter.runInSandbox(({ context }) => {
          return {
            firstCheck: context.b,
            secondCheck: typeof context.a.b === 'undefined'
          }
        }, {
          getContext: () => {
            return {
              a: { b: 'foo' }
            }
          },
          onEval: async ({ run }) => {
            await run("this.b = typeof a.b === 'undefined'")
          },
          propertiesConfig: {
            'a.b': {
              sandboxHidden: true
            }
          }
        })

        res.content = Buffer.from(JSON.stringify({
          sandboxResult: result
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

    should(result.sandboxResult.firstCheck).be.true()
    should(result.sandboxResult.secondCheck).be.true()
  })

  it('should make simple props readonly', async () => {
    const functions = {
      afterRender: (async (req, res, reporter) => {
        const result = await reporter.runInSandbox(({ context }) => {
          return context.a
        }, {
          getContext: () => {
            return {
              a: { b: 'foo' }
            }
          },
          onEval: async ({ run }) => {
            await run('a.b = 1')
          },
          propertiesConfig: {
            'a.b': {
              sandboxReadOnly: true
            }
          }
        })

        res.content = Buffer.from(JSON.stringify({
          sandboxResult: result
        }))
      }).toString()
    }

    return should(reporter.render({
      template: {
        engine: 'none',
        content: JSON.stringify(functions),
        recipe: 'html'
      }
    })).be.rejectedWith(/Can't modify read only property/)
  })

  it('should make simple props readonly #2', async () => {
    const functions = {
      afterRender: (async (req, res, reporter) => {
        const result = await reporter.runInSandbox(({ context }) => {
          context.a.b = 1
          return context.a
        }, {
          getContext: () => {
            return {
              a: { b: 'foo' }
            }
          },
          propertiesConfig: {
            'a.b': {
              sandboxReadOnly: true
            }
          }
        })

        res.content = Buffer.from(JSON.stringify({
          sandboxResult: result
        }))
      }).toString()
    }

    return should(reporter.render({
      template: {
        engine: 'none',
        content: JSON.stringify(functions),
        recipe: 'html'
      }
    })).be.rejectedWith(/Can't modify read only property/)
  })

  it('should make props readonly one level recursively', async () => {
    const functions = {
      afterRender: (async (req, res, reporter) => {
        const result = await reporter.runInSandbox(({ context }) => {
          return context.a
        }, {
          getContext: () => {
            return {
              a: { b: { c: 'foo' } }
            }
          },
          onEval: async ({ run }) => {
            await run('a.b.c = 1')
          },
          propertiesConfig: {
            'a.b': {
              sandboxReadOnly: true
            }
          }
        })

        res.content = Buffer.from(JSON.stringify({
          sandboxResult: result
        }))
      }).toString()
    }

    return should(reporter.render({
      template: {
        engine: 'none',
        content: JSON.stringify(functions),
        recipe: 'html'
      }
    })).be.rejectedWith(/Can't add or modify property/)
  })

  it('should make props readonly one level recursively #2', async () => {
    const functions = {
      afterRender: (async (req, res, reporter) => {
        const result = await reporter.runInSandbox(({ context }) => {
          context.a.b.c = 1
          return context.a
        }, {
          getContext: () => {
            return {
              a: { b: { c: 'foo' } }
            }
          },
          propertiesConfig: {
            'a.b': {
              sandboxReadOnly: true
            }
          }
        })

        res.content = Buffer.from(JSON.stringify({
          sandboxResult: result
        }))
      }).toString()
    }

    return should(reporter.render({
      template: {
        engine: 'none',
        content: JSON.stringify(functions),
        recipe: 'html'
      }
    })).be.rejectedWith(/Can't add or modify property/)
  })

  it('should allow configure top level and inner level properties at the same time', async () => {
    const functions = {
      afterRender: (async (req, res, reporter) => {
        const result = await reporter.runInSandbox(({ context }) => {
          return typeof context.a.b.c === 'undefined'
        }, {
          getContext: () => {
            return {
              a: { b: { c: 'foo' } }
            }
          },
          propertiesConfig: {
            'a.b': {
              sandboxReadOnly: true
            },
            'a.b.c': {
              sandboxHidden: true
            }
          }
        })

        res.content = Buffer.from(JSON.stringify({
          sandboxResult: result
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

    should(result.sandboxResult).be.true()

    const functions2 = {
      afterRender: (async (req, res, reporter) => {
        const result = await reporter.runInSandbox(({ context }) => {
          return typeof context.a
        }, {
          getContext: () => {
            return {
              a: { b: { c: 'foo' } }
            }
          },
          onEval: async ({ run }) => {
            await run('a.b.c = 1')
          },
          propertiesConfig: {
            'a.b': {
              sandboxReadOnly: true
            },
            'a.b.c': {
              sandboxHidden: true
            }
          }
        })

        res.content = Buffer.from(JSON.stringify({
          sandboxResult: result
        }))
      }).toString()
    }

    return should(reporter.render({
      template: {
        engine: 'none',
        content: JSON.stringify(functions2),
        recipe: 'html'
      }
    })).be.rejectedWith(/Can't add or modify property/)
  })

  it('should not fail when configuring top level and inner level properties but parent value is empty', async () => {
    const functions = {
      afterRender: (async (req, res, reporter) => {
        const result = await reporter.runInSandbox(({ context }) => {
          return context.a.b === undefined
        }, {
          getContext: () => {
            return {
              a: {}
            }
          },
          propertiesConfig: {
            'a.b': {
              sandboxReadOnly: true
            },
            'a.b.c': {
              sandboxHidden: true
            }
          }
        })

        res.content = Buffer.from(JSON.stringify({
          sandboxResult: result
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

    should(result.sandboxResult).be.true()
  })

  it('restore should reveal hidden props', async () => {
    const functions = {
      afterRender: (async (req, res, reporter) => {
        const result = await reporter.runInSandbox(({ context, restore }) => {
          const beforeRestore = context.a.b === undefined

          const restoredContext = restore()

          const afterRestore = restoredContext.a.b !== undefined

          return {
            beforeRestore,
            afterRestore
          }
        }, {
          getContext: () => {
            return {
              a: { b: 'foo' }
            }
          },
          propertiesConfig: {
            'a.b': {
              sandboxHidden: true
            }
          }
        })

        res.content = Buffer.from(JSON.stringify({
          sandboxResult: result
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

    should(result.sandboxResult.beforeRestore).be.true()
    should(result.sandboxResult.afterRestore).be.true()
  })

  it('be able to stringify object when non-existent properties are configured', async () => {
    const functions = {
      afterRender: (async (req, res, reporter) => {
        const result = await reporter.runInSandbox(({ context }) => {
          return JSON.stringify(context)
        }, {
          getContext: () => {
            return {
              a: { b: 'foo' }
            }
          },
          propertiesConfig: {
            'a.d': {
              sandboxHidden: true
            },
            'a.c': {
              sandboxReadOnly: true
            }
          }
        })

        res.content = Buffer.from(JSON.stringify({
          sandboxResult: result
        }))
      }).toString()
    }

    return should(reporter.render({
      template: {
        engine: 'none',
        content: JSON.stringify(functions),
        recipe: 'html'
      }
    })).not.be.rejected()
  })

  it('should prevent constructor hacks', async () => {
    const functions = {
      afterRender: (async (req, res, reporter) => {
        const result = await reporter.runInSandbox(() => {}, {
          getContext: () => {
            return {}
          },
          onEval: async ({ run }) => {
            await run("this.constructor.constructor('return process')().exit()")
          }
        })

        res.content = Buffer.from(JSON.stringify({
          sandboxResult: result
        }))
      }).toString()
    }

    return should(reporter.render({
      template: {
        engine: 'none',
        content: JSON.stringify(functions),
        recipe: 'html'
      }
    })).be.rejectedWith(/process is not defined/)
  })

  it('should allow top level await in sandbox eval', async () => {
    const functions = {
      afterRender: (async (req, res, reporter) => {
        const result = await reporter.runInSandbox(() => {}, {
          getContext: () => {
            return {}
          },
          onEval: async ({ run }) => {
            await run('await new Promise((resolve) => resolve())')
          }
        })

        res.content = Buffer.from(JSON.stringify({
          sandboxResult: result
        }))
      }).toString()
    }

    return should(reporter.render({
      template: {
        engine: 'none',
        content: JSON.stringify(functions),
        recipe: 'html'
      }
    })).be.not.rejected()
  })
})
