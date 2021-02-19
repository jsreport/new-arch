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

  it('should emit profile messages', async () => {
    const renderReq = {
      template: {
        content: 'Hello',
        engine: 'none',
        recipe: 'html',
        helpers: 'console.log(\'foo\')'
      }
    }

    const profiler = reporter.attachProfiler(renderReq)
    const messages = []
    profiler.on('profile', (m) => messages.push(m))

    await reporter.render(renderReq)

    // evry operation start should have a matching end
    for (const message of messages.filter(m => m.type === 'operationStart')) {
      messages.find(m => m.id === message.id && m.type === 'operationEnd').should.be.ok()
    }

    should(messages[0].previousOperationId).be.null()
    // evry operation start except first one should have valid previousOperationId
    for (const message of messages.filter(m => m.type === 'operationStart').slice(1)) {
      messages.find(m => m.id === message.previousOperationId).should.be.ok()
      message.id.should.not.be.eql(message.previousOperationId)
    }

    // all operations should produce valid req json after patch apply
    let currentReqStr = ''
    for (const message of messages) {
      if (message.type === 'operationStart' || message.type === 'operationEnd') {
        currentReqStr = applyPatch(currentReqStr, message.req.diff)
        JSON.parse(currentReqStr)
      }
    }

    // should produce proper result after applying diffs
    let currentResBuffer = Buffer.from('')
    for (const message of messages) {
      if (message.type === 'operationStart' || message.type === 'operationEnd') {
        if (message.res.content == null) {
          continue
        }

        currentResBuffer = Buffer.from(applyPatch(currentResBuffer.toString(), message.res.content.content))
      }
    }
    currentResBuffer.toString().should.be.eql('Hello')
    messages.find(m => m.type === 'log' && m.message.includes('foo') && m.previousOperationId != null).should.be.ok()
  })

  it('should produce messages with base64 encoded binary res', async () => {
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
    const messages = []
    profiler.on('profile', (m) => messages.push(m))

    await reporter.render(renderReq)

    let currentResBuffer = Buffer.from('')
    for (const message of messages) {
      if (message.type === 'operationStart' || message.type === 'operationEnd') {
        if (message.res.content == null) {
          continue
        }

        if (message.res.content.encoding === 'diff') {
          currentResBuffer = Buffer.from(applyPatch(currentResBuffer.toString(), message.res.content.content))
        } else {
          currentResBuffer = Buffer.from(message.res.content.content, 'base64')
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
    const messages = []
    profiler.on('profile', (m) => messages.push(m))

    await reporter.render(renderReq)
    const childRenderStart = messages.slice(1).find(m => m.type === 'operationStart' && m.subtype === 'render')
    childRenderStart.previousOperationId.should.be.eql(messages[0].id)
  })
})
