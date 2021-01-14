const should = require('should')
const JsReport = require('jsreport-core')

describe('scripts', () => {
  let reporter

  beforeEach(() => {
    reporter = JsReport()
      .use(require('jsreport-templates')())
      .use(require('jsreport-assets')())
      .use(require('jsreport-jsrender')())
      .use(require('../')({ allowedModules: ['bluebird', 'helperA'], timeout: 4000 }))
      .use(JsReport.tests.listeners())
    return reporter.init()
  })

  afterEach(() => reporter.close())

  common()
  commonSafe()

  function commonSafe () {
    it('should propagate exception from async back', async () => {
      try {
        await reporter.render({
          template: {
            content: 'foo',
            scripts: [{
              content: `function beforeRender(req, res, done) { setTimeout(function() { foo; }, 0); }`
            }],
            engine: 'none',
            recipe: 'html'
          }
        })
        throw new Error('Should have fail')
      } catch (e) {
        if (e.message === 'Should have fail') {
          throw e
        }

        e.message.should.containEql('foo')
      }
    })
  }

  function common () {
    it('should find script by its name', async () => {
      await reporter.documentStore.collection('scripts').insert({
        content: `function beforeRender(req, res) { req.template.content = 'xxx' }`,
        name: 'foo'
      })

      const res = await reporter.render({
        template: {
          content: 'foo',
          scripts: [{ name: 'foo' }],
          engine: 'none',
          recipe: 'html'
        }
      })
      res.content.toString().should.be.eql('xxx')
    })

    it('should be able to handle multiple scripts with beforeRender and execute them in order', async () => {
      await reporter.documentStore.collection('scripts').insert({
        name: 'a',
        content: 'function beforeRender(request, response, done) { request.template.content = \'a\'; done(); }',
        shortid: 'a'
      })
      await reporter.documentStore.collection('scripts').insert({
        content: 'function beforeRender(request, response, done) { request.template.content += \'b\'; done(); }',
        shortid: 'b',
        name: 'b'
      })
      await reporter.documentStore.collection('scripts').insert({
        content: 'function beforeRender(request, response, done) { request.template.content += \'c\'; done(); }',
        shortid: 'c',
        name: 'c'
      })
      await reporter.documentStore.collection('scripts').insert({
        content: 'function beforeRender(request, response, done) { request.template.content += \'d\'; done(); }',
        shortid: 'd',
        name: 'd'
      })

      const res = await reporter.render({
        template: {
          content: 'foo',
          engine: 'none',
          recipe: 'html',
          scripts: [{ shortid: 'a' }, { shortid: 'b' }, { shortid: 'c' }, { shortid: 'd' }]
        }
      })

      res.content.toString().should.be.eql('abcd')
    })

    it('should throw only weak error when script is not found', async () => {
      try {
        await reporter.render({
          template: { content: 'foo', scripts: [{ shortid: 'a' }] }
        })
      } catch (e) {
        e.weak.should.be.ok()
      }
    })

    it('should be able to handle multiple scripts with afterRender and execute them in order', async () => {
      await reporter.documentStore.collection('scripts').insert({
        name: 'a',
        content: 'function afterRender(request, response, done) { response.content = \'a\'; done(); }',
        shortid: 'a'
      })
      await reporter.documentStore.collection('scripts').insert({
        content: 'function afterRender(request, response, done) { response.content = Buffer.from(response.content).toString() + \'b\'; done(); }',
        name: 'b',
        shortid: 'b'
      })
      await reporter.documentStore.collection('scripts').insert({
        content: 'function afterRender(request, response, done) { response.content = Buffer.from(response.content).toString() + \'c\'; done(); }',
        name: 'c',
        shortid: 'c'
      })
      await reporter.documentStore.collection('scripts').insert({
        content: 'function afterRender(request, response, done) { response.content = Buffer.from(response.content).toString() + \'d\'; done(); }',
        name: 'd',
        shortid: 'd'
      })

      const res = await reporter.render({
        template: { engine: 'none', recipe: 'html', content: 'foo', scripts: [{ shortid: 'a' }, { shortid: 'b' }, { shortid: 'c' }, { shortid: 'd' }] }
      })

      res.content.toString().should.be.eql('abcd')
    })

    it('should prepend global scripts in beforeRender', async () => {
      await reporter.documentStore.collection('scripts').insert({
        content: 'function beforeRender(request, response, done) { request.template.content += \'a\'; done(); }',
        name: 'a',
        shortid: 'a'
      })
      await reporter.documentStore.collection('scripts').insert({
        content: 'function beforeRender(request, response, done) { request.template.content += \'b\'; done(); }',
        name: 'b',
        shortid: 'b',
        isGlobal: true
      })
      const res = await reporter.render({
        template: { content: 'x', engine: 'none', recipe: 'html', scripts: [{ shortid: 'a' }] }
      })
      res.content.toString().should.be.eql('xba')
    })

    it('should not be able to see internal context data in scripts', async () => {
      const res = await reporter.render({
        template: {
          content: 'x',
          recipe: 'html',
          engine: 'none',
          scripts: [{
            content: `
              function afterRender(req, res) {             
                res.content = Buffer.from(JSON.stringify(req.context))                
              }
            `
          }]
        }
      })

      const context = JSON.parse(res.content.toString())

      should(context._parsedScripts).not.be.ok()
      should(context.shouldRunAfterRender).not.be.ok()
    })

    it('should be able to modify request.data', async () => {
      const res = await reporter.render({
        template: {
          content: '{{:foo}}',
          recipe: 'html',
          engine: 'jsrender',
          scripts: [{
            content: `
              function beforeRender(req, res, done) { req.data.foo= 'xxx'; done() }
            `
          }]
        }
      })

      res.content.toString().should.be.eql('xxx')
    })

    it('should be able to processes async function', async () => {
      const res = await reporter.render({
        template: {
          content: 'yyyy',
          recipe: 'html',
          engine: 'none',
          scripts: [{
            content: `
              function beforeRender(req, res, done) { setTimeout(function(){ req.template.content = 'xxx'; done(); }, 10); }
            `
          }]
        }
      })

      res.content.toString().should.be.eql('xxx')
    })

    it('res.content in afterRender should be buffer', async () => {
      return reporter.render({
        template: {
          content: 'yyy',
          recipe: 'html',
          engine: 'none',
          scripts: [{
            content: `
            function afterRender(req, res, done){ if (!Buffer.isBuffer(res.content)) { return done(new Error('not a buffer')) } done(); }
            `
          }]
        }
      })
    })

    it('should be able to add property to request context', async () => {
      const res = await reporter.render({
        template: {
          content: 'content',
          recipe: 'html',
          engine: 'none',
          scripts: [{
            content: `
              function beforeRender(req, res) {  req.context.foo = 'xxx' }
              function afterRender(req, res) { res.content = Buffer.from(req.context.foo) }
            `
          }]
        }
      })

      res.content.toString().should.be.eql('xxx')
    })

    it('should be able to cancel request', async () => {
      try {
        await reporter.render({
          template: {
            content: 'content',
            recipe: 'html',
            engine: 'none',
            scripts: [{
              content: `
                function beforeRender(req, res) {  req.cancel() }               
              `
            }]
          }
        })
        throw new Error('Should have failed')
      } catch (e) {
        e.canceled.should.be.true()
        e.message.should.not.be.eql('Should have failed')
      }
    })

    it('should be able to cancel request with message', async () => {
      try {
        await reporter.render({
          template: {
            content: 'content',
            recipe: 'html',
            engine: 'none',
            scripts: [{
              content: `
                function beforeRender(req, res) {  req.cancel('custom message') }               
              `
            }]
          }
        })
        throw new Error('Should have failed')
      } catch (e) {
        e.canceled.should.be.true()
        e.message.should.containEql('custom message')
      }
    })

    it('should be able to cancel request with message', async () => {
      try {
        await reporter.render({
          template: {
            content: 'content',
            recipe: 'html',
            engine: 'none',
            scripts: [{
              content: `
                function beforeRender(req, res) {  req.cancel({ message: 'custom message', statusCode: 406 }) }               
              `
            }]
          }
        })
        throw new Error('Should have failed')
      } catch (e) {
        e.canceled.should.be.true()
        e.statusCode.should.be.eql(406)
        e.message.should.containEql('custom message')
      }
    })

    it('should be able to require jsreport-proxy and render', async () => {
      await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        content: 'foo',
        engine: 'jsrender',
        recipe: 'html'
      })
      const request = {
        template: {
          content: 'original',
          recipe: 'html',
          engine: 'jsrender',
          scripts: [{
            content: `
              const jsreport = require('jsreport-proxy')
              async function afterRender(req, res) {
                const renderRes = await jsreport.render({ template: { name: 'foo' } })
                res.content = renderRes.content
              }`
          }]
        }
      }
      const response = await reporter.render(request)
      response.content.toString().should.be.eql('foo')
    })

    it('should be able to require jsreport-proxy and render and reuse the shared context', async () => {
      await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        content: 'foo',
        engine: 'none',
        recipe: 'html',
        scripts: [{
          content: `
            async function beforeRender(req, res) {
              req.context.shared.text += '2'
            }`
        }]
      })

      const request = {
        template: {
          content: 'original',
          recipe: 'html',
          engine: 'none',
          scripts: [{
            content: `
              const jsreport = require('jsreport-proxy')
              async function afterRender(req, res) {
                req.context.shared.text += '1'
                await jsreport.render({ template: { name: 'foo' } })
                req.context.shared.text += '3'
                res.content = req.context.shared.text
              }`
          }]
        },
        context: {
          shared: {
            text: ''
          }
        }
      }
      const response = await reporter.render(request)
      response.content.toString().should.be.eql('123')
    })

    it('should be able to require jsreport-proxy and render and get logs', async () => {
      await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        content: '{{:~sayHi("foo")}}',
        engine: 'jsrender',
        recipe: 'html',
        helpers: `
          function sayHi (name) {
            console.log('using helper "sayHi"')
            return "Hi " + name
          }
        `
      })

      const request = {
        template: {
          content: 'original',
          recipe: 'html',
          engine: 'jsrender',
          scripts: [{
            content: `
              const jsreport = require('jsreport-proxy')
              function afterRender(req, res, done) {
                console.log('message from script')

                jsreport.render({ template: { name: 'foo' } }).then((resp) => {
                  res.content = resp.content;
                  done();
                }).catch((e) => done(e))
              }`
          }]
        }
      }

      const response = await reporter.render(request)

      response.content.toString().should.be.eql('Hi foo')

      const logs = response.meta.logs.map((i) => i.message)

      logs.should.matchAny(/Rendering template { name: foo/)
      logs.should.matchAny(/message from script/)
      logs.should.matchAny(/using helper "sayHi"/)
    })

    it('should not be able to override context when rendering with jsreport-proxy', async () => {
      await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        content: 'foo',
        engine: 'jsrender',
        recipe: 'html'
      })

      const request = {
        template: {
          content: 'original',
          recipe: 'html',
          engine: 'jsrender',
          scripts: [{
            content: `
              const jsreport = require('jsreport-proxy')

              async function beforeRender (req, res) {
                req.data = req.data || {}
                req.data.some = true
                req.context.another = true
              }

              async function afterRender(req, res) {
                const resp = await jsreport.render({
                  template: { name: 'foo' },
                  context: { user: { name: 'Jan' } }
                })

                res.content = resp.content;
              }`
          }]
        },
        context: {
          user: { name: 'Boris' }
        }
      }

      let contextChangedInsideProxyRender
      let contextUserPropChangedInsideScript
      let contextAnotherPropChangedInsideScript

      reporter.tests.afterRenderListeners.add('testing', (req, res) => {
        if (req.context.isChildRequest) {
          contextChangedInsideProxyRender = req.context.user.name !== 'Boris'
        } else {
          contextUserPropChangedInsideScript = req.context.user.name !== 'Boris'
          contextAnotherPropChangedInsideScript = req.context.another === true
        }
      })

      const response = await reporter.render(request)

      response.content.toString().should.be.eql('foo')
      contextChangedInsideProxyRender.should.be.eql(false)
      contextUserPropChangedInsideScript.should.be.eql(false)
      contextAnotherPropChangedInsideScript.should.be.eql(true)
    })

    it('should be able to require jsreport-proxy and find collection', async () => {
      await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        content: 'foo',
        engine: 'jsrender',
        recipe: 'html'
      })

      await reporter.documentStore.collection('templates').insert({
        name: 'hello',
        content: 'hello',
        engine: 'jsrender',
        recipe: 'html'
      })

      const request = {
        template: {
          content: 'original',
          recipe: 'html',
          engine: 'jsrender',
          scripts: [{
            content: `
              const jsreport = require('jsreport-proxy')
              function beforeRender(req, res, done) {
                jsreport.documentStore.collection('templates').find({name: 'hello'}).then((result) => {
                  req.template.content = result[0].content
                  done();
                }).catch((e) => done(e))
              }`
          }]
        }
      }
      const response = await reporter.render(request)
      response.content.toString().should.be.eql('hello')
    })

    it('should be able to require jsreport-proxy and findOne collection', async () => {
      await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        content: 'foo',
        engine: 'jsrender',
        recipe: 'html'
      })

      await reporter.documentStore.collection('templates').insert({
        name: 'hello',
        content: 'hello',
        engine: 'jsrender',
        recipe: 'html'
      })

      const request = {
        template: {
          content: 'original',
          recipe: 'html',
          engine: 'jsrender',
          scripts: [{
            content: `
              const jsreport = require('jsreport-proxy')
              function beforeRender(req, res, done) {
                jsreport.documentStore.collection('templates').findOne({name: 'hello'}).then((result) => {
                  req.template.content = result.content
                  done();
                }).catch((e) => done(e))
              }`
          }]
        }
      }
      const response = await reporter.render(request)
      response.content.toString().should.be.eql('hello')
    })

    it('should be able to require jsreport-proxy, find collection with parsed buffers', async () => {
      await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        content: 'foo',
        engine: 'jsrender',
        recipe: 'html'
      })

      await reporter.documentStore.collection('assets').insert({
        name: 'hello',
        content: Buffer.from(JSON.stringify({ a: 'foo' }))
      })

      const request = {
        template: {
          content: 'original',
          recipe: 'html',
          engine: 'jsrender',
          scripts: [{
            content: `
              const jsreport = require('jsreport-proxy')
              function beforeRender(req, res, done) {
                jsreport.documentStore.collection('assets').find({name: 'hello'}).then((result) => {
                  req.template.content = JSON.parse(result[0].content.toString()).a
                  done();
                }).catch((e) => done(e))
              }`
          }]
        }
      }
      const response = await reporter.render(request)
      response.content.toString().should.be.eql('foo')
    })

    it('should be able to require jsreport-proxy, findOne collection with parsed buffers', async () => {
      await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        content: 'foo',
        engine: 'jsrender',
        recipe: 'html'
      })

      await reporter.documentStore.collection('assets').insert({
        name: 'hello',
        content: Buffer.from(JSON.stringify({ a: 'foo' }))
      })

      const request = {
        template: {
          content: 'original',
          recipe: 'html',
          engine: 'jsrender',
          scripts: [{
            content: `
              const jsreport = require('jsreport-proxy')
              function beforeRender(req, res, done) {
                jsreport.documentStore.collection('assets').findOne({name: 'hello'}).then((result) => {
                  req.template.content = JSON.parse(result.content.toString()).a
                  done();
                }).catch((e) => done(e))
              }`
          }]
        }
      }
      const response = await reporter.render(request)
      response.content.toString().should.be.eql('foo')
    })

    it('should be able to catch errors inside script when using jsreport-proxy documentStore', async () => {
      const request = {
        template: {
          content: '{{:errorFromStore}}',
          recipe: 'html',
          engine: 'jsrender',
          scripts: [{
            content: `
              const jsreport = require('jsreport-proxy')

              async function beforeRender(req, res) {
                try {
                  await jsreport.documentStore.collection('unknown').find()
                } catch (err) {
                  req.data = req.data || {}
                  req.data.errorFromStore = 'catched'
                }
              }`
          }]
        }
      }
      const response = await reporter.render(request)
      response.content.toString().should.be.eql('catched')
    })

    it('callback error should be gracefully handled', async () => {
      const request = {
        template: {
          content: 'original',
          recipe: 'html',
          engine: 'jsrender',
          scripts: [{
            content: `
              const jsreport = require('jsreport-proxy')
              function afterRender(req, res, done) {
                jsreport.render({ template: {} }).then((resp) => {
                  res.content = resp.content;
                  done();
                }).catch((e) => done(e))
              }`
          }]
        }
      }
      try {
        await reporter.render(request)
        throw new Error('Should have failed.')
      } catch (e) {
        e.message.should.containEql('Template must')
      }
    })

    it('should be able to substitute template with another template using callback', async () => {
      await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        content: 'foo',
        engine: 'jsrender',
        recipe: 'html'
      })

      const request = {
        template: {
          content: 'original',
          recipe: 'html',
          engine: 'jsrender',
          scripts: [{
            content: `
              const jsreport = require('jsreport-proxy')
              function beforeRender(req, res, done) {
                jsreport.render({ template: { name: 'foo' } }).then((resp) => {
                  req.template.content = Buffer.from(resp.content).toString();
                  done();
                }).catch((e) => done(e))
              }`
          }]
        }
      }
      const response = await reporter.render(request)
      response.content.toString().should.be.eql('foo')
    })

    it('should monitor rendering cycles', async function () {
      this.timeout(8000)
      await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        content: 'foo',
        engine: 'jsrender',
        recipe: 'html',
        shortid: 'id',
        scripts: [{
          content: `
              const jsreport = require('jsreport-proxy')
              async function beforeRender(req, res) {
                const resp = await jsreport.render({ template: { name: 'foo' } })
                req.template.content = Buffer.from(resp.content).toString();
              }`
        }]
      })

      const request = {
        template: {
          shortid: 'id'
        }
      }

      try {
        await reporter.render(request)
        throw new Error('It should have failed')
      } catch (e) {
        e.message.should.containEql('cycle')
      }
    })

    it('should fail with script that tries to avoid sandbox (using global context)', async () => {
      await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        content: 'foo',
        engine: 'jsrender',
        recipe: 'html',
        shortid: 'id',
        scripts: [{
          content: `
              function beforeRender(req, res, done) {
                const ForeignFunction = this.constructor.constructor;
                const process1 = ForeignFunction("return process")();
                const require1 = process1.mainModule.require;
                const console1 = require1("console");
                const fs1 = require1("fs");
                console1.log(fs1.statSync('.'))
                done()
              }
          `
        }]
      })

      const request = {
        template: {
          shortid: 'id'
        }
      }

      try {
        await reporter.render(request)
        throw new Error('It should have failed')
      } catch (e) {
        e.message.should.containEql('is not defined')
      }
    })

    it('should fail with script that tries to avoid sandbox (using objects exposed in global context)', async () => {
      await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        content: 'foo',
        engine: 'jsrender',
        recipe: 'html',
        shortid: 'id',
        scripts: [{
          content: `
              function beforeRender(req, res, done) {
                const ForeignFunction = require.constructor
                const process1 = ForeignFunction("return process")()
                const require1 = process1.mainModule.require;
                const console1 = require1("console");
                const fs1 = require1("fs");
                console1.log(fs1.statSync('.'))
                done()
              }
          `
        }]
      })

      const request = {
        template: {
          shortid: 'id'
        }
      }

      try {
        await reporter.render(request)
        throw new Error('It should have failed')
      } catch (e) {
        e.message.should.containEql('is not defined')
      }
    })

    it('should be able to require local scripts', async () => {
      const res = await reporter.render({
        template: {
          content: 'foo',
          engine: 'none',
          recipe: 'html',
          scripts: [{
            content: `function beforeRender(request, response) { request.template.content = require('helperA')(); }`
          }]
        }
      })
      res.content.toString().should.be.eql('a')
    })

    it('should be unblock modules with allowedModules = *', async () => {
      await reporter.close()
      reporter = JsReport({
        extensions: {
          scripts: {
            allowedModules: '*'
          }
        }
      }).use(require('jsreport-templates')()).use(require('jsreport-jsrender')()).use(require('../')())

      await reporter.init()
      const res = await reporter.render({
        template: {
          content: 'foo',
          engine: 'none',
          recipe: 'html',
          scripts: [{
            content: `function beforeRender(request, response) { request.template.content = require('helperA')(); }`
          }]
        }
      })
      res.content.toString().should.be.eql('a')
    })

    it('should be possible to declare global request object', async () => {
      const res = await reporter.render({
        template: {
          content: 'content',
          recipe: 'html',
          engine: 'none',
          scripts: [{
            content: `var request = function () { return '5'; } \n function beforeRender(req, res, done) { req.template.content = request(); done() }`
          }]
        }
      })

      res.content.toString().should.be.eql('5')
    })

    it('should fire beforeScriptListeners', async () => {
      reporter.tests.beforeRenderEval((req, res, { reporter }) => {
        reporter.beforeScriptListeners.add('test', (def, req) => {
          req.template.content = def.script
        })
      })

      const res = await reporter.render({
        template: {
          content: 'hello',
          engine: 'none',
          recipe: 'html',
          scripts: [{
            content: `function beforeRender(req, res) { }`
          }]
        }
      })

      res.content.toString().should.be.eql(`function beforeRender(req, res) { }`)
    })

    it('should write console.log to the logger', async () => {
      let logged = false
      reporter.logger.debug = (msg) => {
        if (msg.includes('hello')) {
          logged = true
        }
      }

      await reporter.render({
        template: {
          content: 'content',
          recipe: 'html',
          engine: 'none',
          scripts: [{
            content: `function beforeRender(req, res) { console.log('hello') }`
          }]
        }
      })

      logged.should.be.true()
    })

    it('should fail with proper Error', async () => {
      return reporter.render({
        template: {
          content: 'main',
          recipe: 'html',
          engine: 'none',
          scripts: [{
            content: `function beforeRender(req, res, done) { done(new Error('foo')) } `
          }]
        }
      }).should.be.rejectedWith(/foo/)
    })

    it('should disallow throwing values that are not errors (promise usage)', async () => {
      await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        content: 'foo',
        engine: 'jsrender',
        recipe: 'html',
        shortid: 'id',
        scripts: [{
          content: `
            async function beforeRender(req, res) {
              throw 2
            }
          `
        }]
      })

      const request = {
        template: {
          shortid: 'id'
        }
      }

      try {
        await reporter.render(request)
        throw new Error('It should have failed')
      } catch (e) {
        e.message.should.containEql('Script threw with non-Error')
      }
    })

    it('should disallow throwing values that are not errors (callback usage)', async () => {
      await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        content: 'foo',
        engine: 'jsrender',
        recipe: 'html',
        shortid: 'id',
        scripts: [{
          content: `
            function beforeRender(req, res, done) {
              done(2)
            }
          `
        }]
      })

      const request = {
        template: {
          shortid: 'id'
        }
      }

      try {
        await reporter.render(request)
        throw new Error('It should have failed')
      } catch (e) {
        e.message.should.containEql('Script threw with non-Error')
      }
    })

    // TODO, it dont want to find bluebird when running in monorep
    it.skip('should not break when using different Promise implementation inside script', async () => {
      await reporter.documentStore.collection('templates').insert({
        name: 'foo',
        content: 'foo',
        engine: 'jsrender',
        recipe: 'html',
        shortid: 'id',
        scripts: [{
          content: `
            const Promise = require('bluebird')

            function beforeRender(req, res) {

            }
          `
        }]
      })

      const request = {
        template: {
          shortid: 'id'
        }
      }

      await reporter.render(request)
    })
  }
})
