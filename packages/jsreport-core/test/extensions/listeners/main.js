const ListenerCollection = require('listener-collection')

module.exports = (reporter, definition) => {
  reporter.tests = reporter.tests || {}
  reporter.tests.beforeRenderListeners = new ListenerCollection()
  reporter.tests.afterRenderListeners = new ListenerCollection()
  reporter.tests.validateRenderListeners = new ListenerCollection()
  reporter.tests.afterTemplatingEnginesExecutedListeners = new ListenerCollection()

  reporter.registerMainAction('test-beforeRender-listeners', async (data, req) => {
    data.req = reporter.Request(data.req)
    await reporter.tests.beforeRenderListeners.fire(data.req, data.res)
    return { req: data.req, res: data.res }
  })
  reporter.registerMainAction('test-afterRender-listeners', async (data, req) => {
    data.req = reporter.Request(data.req)
    await reporter.tests.afterRenderListeners.fire(data.req, data.res)
    return { req: data.req, res: data.res }
  })
  reporter.registerMainAction('test-validateRender-listeners', async (data, req) => {
    data.req = reporter.Request(data.req)
    await reporter.tests.validateRenderListeners.fire(data.req, data.res)
    return { req: data.req, res: data.res }
  })
  reporter.registerMainAction('test-afterTemplatingEnginesExecuted-listeners', async (data, req) => {
    data.req = reporter.Request(data.req)
    await reporter.tests.afterTemplatingEnginesExecutedListeners.fire(data.req, data.res)
    return { req: data.req, res: data.res }
  })

  let beforeRenderEval
  reporter.tests.beforeRenderEval = (fn) => {
    beforeRenderEval = fn
  }
  reporter.registerMainAction('test-beforeRenderEval', async (data, req) => {
    if (beforeRenderEval == null) {
      return
    }
    return beforeRenderEval.toString()
  })
}
