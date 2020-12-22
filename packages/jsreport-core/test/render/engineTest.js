const should = require('should')
const extend = require('node.extend.without.arrays')
const core = require('../../index')

describe('engine', () => {
  let reporter

  beforeEach(async () => {
    reporter = createReporter()
    await reporter.init()
  })

  afterEach(async () => {
    if (reporter) {
      await reporter.close()
    }
  })

  it('should be able to return from none engine', async () => {
    const res = await reporter.render({
      template: {
        content: 'content',
        engine: 'none',
        recipe: 'html'
      }
    })

    should(res.content.toString()).be.eql('content')
  })

  it('should send compiled helpers to the engine', async () => {
    const res = await reporter.render({
      template: {
        content: 'content',
        helpers: 'function a() { return "foo"; }',
        engine: 'helpers',
        recipe: 'html'
      }
    })

    should(res.content.toString()).be.eql('foo')
  })

  it('should be able to run async helper', async () => {
    const res = await reporter.render({
      template: {
        content: 'content',
        helpers: 'async function a() { return "foo"; }',
        engine: 'helpers',
        recipe: 'html'
      }
    })

    should(res.content.toString()).be.eql('foo')
  })

  it('should throw valid Error when error from async helper', async () => {
    return should(reporter.render({
      template: {
        content: 'content',
        helpers: 'async function a() { throw new Error("async error") }',
        engine: 'helpers',
        recipe: 'html'
      }
    })).be.rejectedWith(/async error/)
  })

  it('should send custom require to engine', async () => {
    const res = await reporter.render({
      template: {
        content: 'content',
        engine: 'passRequire',
        recipe: 'html'
      }
    })

    should(res.content.toString()).be.eql('content_require_complete')
  })

  it('should send data to the engine', async () => {
    const res = await reporter.render({
      template: {
        content: '',
        engine: 'data',
        recipe: 'html'
      },
      data: {
        a: {
          val: 'foo'
        }
      }
    })

    should(res.content.toString()).be.eql('foo')
  })

  it('should block not allowed modules', async () => {
    return should(reporter.render({
      template: {
        content: '',
        helpers: 'function a() { require("fs"); }',
        engine: 'helpers',
        recipe: 'html'
      }
    })).be.rejectedWith(/module has been blocked/)
  })

  it('should unblock all modules with *', async () => {
    const reporter2 = createReporter({
      templatingEngines: {
        allowedModules: '*'
      }
    })

    await reporter2.init()

    const res = await reporter2.render({
      template: {
        content: '',
        helpers: 'function a() { require("fs"); return "foo" }',
        engine: 'helpers',
        recipe: 'html'
      }
    })

    should(res.content.toString()).be.eql('foo')

    await reporter2.close()
  })

  it('should be able to extend allowed modules', async () => {
    const reporter2 = createReporter({
      templatingEngines: {
        allowedModules: ['fs']
      }
    })

    await reporter2.init()

    const res = await reporter2.render({
      template: {
        content: '',
        helpers: 'function a() { require("fs"); return "foo" }',
        engine: 'helpers',
        recipe: 'html'
      }
    })

    should(res.content.toString()).be.eql('foo')

    await reporter2.close()
  })

  it('should be able to use native modules', async () => {
    const res = await reporter.render({
      template: {
        content: '',
        helpers: 'function a() { return "foo_" + String(typeof uuid != "undefined") }',
        engine: 'helpers',
        recipe: 'html'
      }
    })

    should(res.content.toString()).be.eql('foo_true')
  })

  it('should extract references from input string', async () => {
    const res = await reporter.render({
      template: {
        content: '',
        engine: 'data',
        recipe: 'html'
      },
      data: {
        $id: 0,
        b: { $id: '1', val: 'foo' },
        a: { $ref: '1' }
      }
    })

    should(res.content.toString()).be.eql('foo')
  })

  it('should not fail when extracting references from array containing null', async () => {
    return should(reporter.render({
      template: {
        content: '',
        engine: 'none',
        recipe: 'html'
      },
      data: {
        arr: [null]
      }
    })).be.fulfilled()
  })

  it('should work with $ref schema and array with primitive', async () => {
    const input = {
      $id: '1',
      foo: [1, 2, 3]
    }

    const expected = { foo: [1, 2, 3] }

    const res = await reporter.render({
      template: {
        content: '',
        engine: 'data2',
        recipe: 'html'
      },
      data: input
    })

    const rawContent = JSON.parse(res.content.toString())
    const content = {}

    for (const [key, value] of Object.entries(rawContent)) {
      if (key.startsWith('__')) {
        continue
      }

      content[key] = value
    }

    should(JSON.stringify(content)).be.eql(JSON.stringify(expected))
  })

  it('should be able use local modules if enabled in allowedModules', async () => {
    const reporter2 = createReporter({
      rootDirectory: __dirname,
      appDirectory: __dirname,
      templatingEngines: {
        allowedModules: ['helperB']
      }
    })

    await reporter2.init()

    const res = await reporter2.render({
      template: {
        content: '',
        helpers: 'function a() { return require("helperB")(); }',
        engine: 'helpers',
        recipe: 'html'
      }
    })

    should(res.content.toString()).be.eql('b')

    await reporter2.close()
  })

  it('should be able use local modules if enabled in allowedModules and rootDirectory path points there', async () => {
    const reporter2 = createReporter({
      rootDirectory: __dirname,
      appDirectory: 'foo',
      templatingEngines: {
        allowedModules: ['helperB']
      }
    })

    await reporter2.init()

    const res = await reporter2.render({
      template: {
        content: '',
        helpers: 'function a() { return require("helperB")(); }',
        engine: 'helpers',
        recipe: 'html'
      }
    })

    should(res.content.toString()).be.eql('b')

    await reporter2.close()
  })

  it('should be able use local modules if enabled in allowedModules and appDirectory path points there', async () => {
    const reporter2 = createReporter({
      rootDirectory: 'foo',
      appDirectory: __dirname,
      templatingEngines: {
        allowedModules: ['helperB']
      }
    })

    await reporter2.init()

    const res = await reporter2.render({
      template: {
        content: '',
        helpers: 'function a() { return require("helperB")(); }',
        engine: 'helpers',
        recipe: 'html'
      }
    })

    should(res.content.toString()).be.eql('b')

    await reporter2.close()
  })

  it('should be able use local modules if enabled in allowedModules and parentModuleDirectory path points there', async () => {
    const reporter2 = createReporter({
      rootDirectory: 'foo',
      appDirectory: 'foo',
      parentModuleDirectory: __dirname,
      templatingEngines: {
        allowedModules: ['helperB']
      }
    })

    await reporter2.init()

    const res = await reporter2.render({
      template: {
        content: '',
        helpers: 'function a() { return require("helperB")(); }',
        engine: 'helpers',
        recipe: 'html'
      }
    })

    should(res.content.toString()).be.eql('b')

    await reporter2.close()
  })

  it('should return logs from console', async () => {
    const res = await reporter.render({
      template: {
        content: '',
        helpers: 'function a() { console.log(\'foo\') }',
        engine: 'helpers',
        recipe: 'html'
      }
    })

    should(res.meta.logs).matchAny((l) => {
      should(l.message).be.eql('foo')
    })
  })

  it('should return dumped logs from console', async () => {
    const res = await reporter.render({
      template: {
        content: '',
        helpers: 'function a() { console.log({a: 1}) }',
        engine: 'helpers',
        recipe: 'html'
      }
    })

    should(res.meta.logs).matchAny((l) => {
      should(l.message).be.eql('{ a: 1 }')
    })
  })

  it('should be able require modules by aliases', async () => {
    const res = await reporter.render({
      template: {
        content: '',
        helpers: 'function a() { return require("module"); }',
        engine: 'helpers',
        recipe: 'html'
      }
    })

    should(res.content.toString()).be.eql('foo')
  })

  it('should terminate endless loop after timeout', async () => {
    const reporter2 = createReporter({
      reportTimeout: 500
    })

    await reporter2.init()

    return should(reporter2.render({
      template: {
        content: '',
        helpers: 'function a() { while(true) {} }',
        engine: 'helpers',
        recipe: 'html'
      }
    }).then(() => reporter2.close())).be.rejectedWith(/timeout/)
  })

  it('should be able to reach buffer in global scope', async () => {
    const res = await reporter.render({
      template: {
        content: '',
        helpers: 'function a() { return typeof Buffer; }',
        engine: 'helpers',
        recipe: 'html'
      }
    })

    should(res.content.toString()).be.eql('function')
  })

  it('should throw valid Error when templating engine throws', async () => {
    return should(reporter.render({
      template: {
        content: '',
        engine: 'helpers',
        recipe: 'html'
      }
    })).be.rejectedWith(/helpers\.a is not a function/)
  })

  it('should disallow throwing values that are not errors (startup)', async () => {
    return should(reporter.render({
      template: {
        content: '',
        helpers: 'throw 2',
        engine: 'helpers',
        recipe: 'html'
      }
    })).be.rejectedWith(/Template execution threw with non-Error/)
  })

  it('should disallow throwing values that are not errors (runtime)', async () => {
    return should(reporter.render({
      template: {
        content: '',
        helpers: 'function a() { throw 2 }',
        engine: 'helpers',
        recipe: 'html'
      }
    })).be.rejectedWith(/Template execution threw with non-Error/)
  })

  it('second hit should go from cache', async () => {
    const templateContent = 'content'

    const res = await reporter.render({
      template: {
        content: templateContent,
        engine: 'none',
        recipe: 'html'
      }
    })

    should(res.content.toString()).be.eql(templateContent)

    const res2 = await reporter.render({
      template: {
        content: templateContent,
        engine: 'none',
        recipe: 'html'
      }
    })

    should(res2.content.toString()).be.eql(templateContent)

    should(res2.meta.logs).matchAny((l) => {
      should(l.message).containEql('Taking compiled template from engine cache')
    })
  })

  it('should return logs from console also on the cache hit', async () => {
    const templateContent = 'content'

    const res = await reporter.render({
      template: {
        content: templateContent,
        helpers: 'function a() { console.log(\'foo\') }',
        engine: 'helpers',
        recipe: 'html'
      }
    })

    should(res.meta.logs).matchAny((l) => {
      should(l.message).be.eql('foo')
    })

    const res2 = await reporter.render({
      template: {
        content: templateContent,
        helpers: 'function a() { console.log(\'foo\') }',
        engine: 'helpers',
        recipe: 'html'
      }
    })

    should(res2.meta.logs).matchAny((l) => {
      should(l.message).be.eql('foo')
    })
  })

  it('should not change the helpers string into object on the original template', async () => {
    const template = {
      content: 'content',
      helpers: 'function a() { return "b"; }',
      engine: 'helpers',
      recipe: 'html'
    }

    const res = await reporter.render({
      template
    })

    should(res.content.toString()).be.eql('b')
    should(template.helpers).be.type('string')
  })
})

function createReporter (options) {
  const reporter = core(extend(true, { discover: false }, options))

  reporter.use({
    name: 'engine-testing',
    directory: __dirname,
    main: 'engineExtMain.js',
    worker: 'engineExtWorker.js'
  })

  return reporter
}
