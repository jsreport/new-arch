const should = require('should')
const jsreport = require('../../')
const { applyPatch } = require('../../lib/worker/render/diff')

describe('profiler', () => {
  let reporter

  beforeEach(() => {
    reporter = jsreport()
    reporter.use(jsreport.tests.listeners())
    return reporter.init()
  })

  afterEach(() => reporter.close())

  it('should emit profile events', async () => {
    const renderReq = {
      template: {
        content: 'Hello',
        engine: 'none',
        recipe: 'html',
        helpers: 'console.log(\'foo\')'
      }
    }

    const profiler = reporter.attachProfiler(renderReq)
    const events = []
    profiler.on('profile', (m) => events.push(m))

    await reporter.render(renderReq)

    // evry operation start should have a matching end
    for (const event of events.filter(m => m.type === 'operationStart')) {
      events.find(m => m.operationId === event.operationId && m.type === 'operationEnd').should.be.ok()
    }

    should(events[0].previousOperationId).be.null()

    // evry operation start except first one should have valid previousOperationId
    for (const event of events.filter(m => m.type === 'operationStart').slice(1)) {
      events.find(m => m.operationId === event.previousOperationId).should.be.ok()
      event.operationId.should.not.be.eql(event.previousOperationId)
    }

    // all operations should produce valid req json after patch apply
    let currentReqStr = ''
    for (const event of events) {
      if (event.type === 'operationStart' || event.type === 'operationEnd') {
        currentReqStr = applyPatch(currentReqStr, event.req.diff)
        JSON.parse(currentReqStr)
      }
    }

    // should produce proper result after applying diffs
    let currentResBuffer = Buffer.from('')
    for (const event of events) {
      if (event.type === 'operationStart' || event.type === 'operationEnd') {
        if (event.res.content == null) {
          continue
        }

        currentResBuffer = Buffer.from(applyPatch(currentResBuffer.toString(), event.res.content.content))
      }
    }
    currentResBuffer.toString().should.be.eql('Hello')
    events.find(m => m.type === 'log' && m.message.includes('foo') && m.previousOperationId != null).should.be.ok()
  })

  it('should produce events with base64 encoded binary res', async () => {
    reporter.tests.beforeRenderEval((req, res, { reporter }) => {
      reporter.extensionsManager.recipes.push({
        name: 'profilerRecipe',
        execute: (req, res) => {
          res.content = Buffer.from([1])
        }
      })
    })

    const renderReq = {
      template: {
        content: 'Hello',
        engine: 'none',
        recipe: 'profilerRecipe'
      }
    }

    const profiler = reporter.attachProfiler(renderReq)
    const events = []
    profiler.on('profile', (m) => events.push(m))

    await reporter.render(renderReq)

    let currentResBuffer = Buffer.from('')
    for (const event of events) {
      if (event.type === 'operationStart' || event.type === 'operationEnd') {
        if (event.res.content == null) {
          continue
        }

        if (event.res.content.encoding === 'diff') {
          currentResBuffer = Buffer.from(applyPatch(currentResBuffer.toString(), event.res.content.content))
        } else {
          currentResBuffer = Buffer.from(event.res.content.content, 'base64')
        }
      }
    }
    currentResBuffer[0].should.be.eql(1)
  })

  it('child render should include correct previousOperationId', async () => {
    reporter.tests.beforeRenderEval(async (req, res, { reporter }) => {
      if (req.template.content === 'main') {
        const childResponse = await reporter.render({
          template: {
            content: 'child',
            engine: 'none',
            recipe: 'html'
          }
        }, req)
        req.template.content += childResponse.content.toString()
      }
    })

    const renderReq = {
      template: {
        content: 'main',
        engine: 'none',
        recipe: 'html'
      }
    }

    const profiler = reporter.attachProfiler(renderReq)
    const events = []
    profiler.on('profile', (m) => events.push(m))

    await reporter.render(renderReq)
    const childRenderStart = events.slice(1).find(m => m.type === 'operationStart' && m.subtype === 'render')
    childRenderStart.previousOperationId.should.be.eql(events[0].operationId)
  })

  it('should persist profiles without req/res', async () => {
    await reporter.render({
      template: {
        engine: 'none',
        recipe: 'html',
        content: 'Hello'
      }
    })

    const profile = await reporter.documentStore.collection('profiles').findOne({})
    should(profile).be.ok()

    profile.state.should.be.eql('success')
    profile.timestamp.should.be.Date()

    const content = await reporter.blobStorage.read(profile.blobName)

    const events = content.toString().split('\n').filter(l => l).map(JSON.parse)
    for (const m of events) {
      should(m.req).not.be.ok()
    }

    events.find(m => m.type === 'log' && m.message.includes('Executing recipe')).should.be.ok()
  })

  it('should persist profiles when request errors', async () => {
    reporter.tests.beforeRenderEval((req) => {
      throw new Error('My error')
    })
    try {
      await reporter.render({
        template: {
          engine: 'none',
          recipe: 'html',
          content: 'Hello'
        }
      })
    } catch (e) {

    }
    await new Promise(resolve => setTimeout(resolve, 100))

    const profile = await reporter.documentStore.collection('profiles').findOne({})
    profile.state.should.be.eql('error')

    const content = await reporter.blobStorage.read(profile.blobName)
    const events = content.toString().split('\n').filter(l => l).map(JSON.parse)
    const errorMesage = events.find(m => m.type === 'error')
    should(errorMesage).be.ok()
  })

  it('should persist profile also when request doesnt reach the worker', async () => {
    reporter.beforeRenderListeners.add('test', () => {
      throw new Error('My error')
    })

    try {
      await reporter.render({
        template: {
          engine: 'none',
          recipe: 'html',
          content: 'Hello'
        }
      })
    } catch (e) {

    }

    const profile = await reporter.documentStore.collection('profiles').findOne({})
    profile.state.should.be.eql('error')

    const content = await reporter.blobStorage.read(profile.blobName)
    const events = content.toString().split('\n').filter(l => l).map(JSON.parse)
    const errorMesage = events.find(m => m.type === 'error')
    should(errorMesage).be.ok()
  })

  it('should persist profiles with req/res when settings fullProfilerRunning enabled', async () => {
    await reporter.documentStore.collection('settings').update({
      key: 'fullProfilerRunning'
    }, {
      $set: {
        value: true,
        key: 'fullProfilerRunning'
      }
    }, { upsert: true })

    await reporter.render({
      template: {
        engine: 'none',
        recipe: 'html',
        content: 'Hello'
      }
    })

    const profile = await reporter.documentStore.collection('profiles').findOne({})
    const content = await reporter.blobStorage.read(profile.blobName)

    const events = content.toString().split('\n').filter(l => l).map(JSON.parse)
    for (const m of events.filter(m => m.type !== 'log')) {
      should(m.req).be.ok()
    }
  })

  it('should delete profile blob when profile is deleted', async () => {
    await reporter.render({
      template: {
        engine: 'none',
        recipe: 'html',
        content: 'Hello'
      }
    })

    const profile = await reporter.documentStore.collection('profiles').findOne({})
    await reporter.documentStore.collection('profiles').remove({})
    return reporter.blobStorage.read(profile.blobName).should.be.rejectedWith(/found/)
  })

  it('response meta should include profileId', async () => {
    const res = await reporter.render({
      template: {
        engine: 'none',
        recipe: 'html',
        content: 'Hello'
      }
    })

    res.meta.profileId.should.be.ok()
    const profile = await reporter.documentStore.collection('profiles').findOne({ _id: res.meta.profileId })
    profile.should.be.ok()
  })
})

describe('profiler with timeout', () => {
  let reporter

  beforeEach(() => {
    reporter = jsreport({
      reportTimeout: 100,
      reportTimeoutMargin: 0
    })
    reporter.use(jsreport.tests.listeners())
    return reporter.init()
  })

  afterEach(() => reporter.close())

  it('should persist profile when request timesout', async () => {
    reporter.tests.afterRenderEval = (fn) => {
      return new Promise((resolve) => setTimeout(resolve, 200))
    }

    try {
      await reporter.render({
        template: {
          engine: 'none',
          recipe: 'html',
          content: 'Hello'
        }
      })
    } catch (e) {

    }

    const profile = await reporter.documentStore.collection('profiles').findOne({})
    profile.state.should.be.eql('error')

    const content = await reporter.blobStorage.read(profile.blobName)
    const events = content.toString().split('\n').filter(l => l).map(JSON.parse)
    const errorMesage = events.find(m => m.type === 'error')
    should(errorMesage).be.ok()
  })
})

describe('profiler cleanup', () => {
  let reporter

  beforeEach(() => {
    reporter = jsreport({
      profiler: {
        maxProfilesHistory: 2,
        cleanupInterval: '50ms'
      }
    })
    reporter.use(jsreport.tests.listeners())
    return reporter.init()
  })

  afterEach(() => reporter.close())
  it('should clean old profiles', async () => {
    for (let i = 0; i < 3; i++) {
      await reporter.render({
        template: {
          engine: 'none',
          recipe: 'html',
          content: 'Hello'
        }
      })
    }
    await new Promise((resolve) => setTimeout(resolve, 60))
    const profiles = await reporter.documentStore.collection('profiles').find({})
    profiles.should.have.length(2)
  })
})
