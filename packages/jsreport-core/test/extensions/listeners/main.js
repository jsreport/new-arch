const ListenerCollection = require('listener-collection')

module.exports = (reporter, definition) => {
  reporter.tests = reporter.tests || {}
  reporter.beforeRenderListeners = new ListenerCollection()
  reporter.afterRenderListeners = new ListenerCollection()
  reporter.validateRenderListeners = new ListenerCollection()
  reporter.afterTemplatingEnginesExecutedListeners = new ListenerCollection()

  reporter.registerMainAction('test-beforeRender-listeners', async (data, req) => {
    data.req = reporter.Request(data.req)
    await reporter.beforeRenderListeners.fire(data.req, data.res)
    return { req: data.req, res: data.res }
  })
  reporter.registerMainAction('test-afterRender-listeners', async (data, req) => {
    data.req = reporter.Request(data.req)
    await reporter.afterRenderListeners.fire(data.req, data.res)
    return { req: data.req, res: data.res }
  })
  reporter.registerMainAction('test-validateRender-listeners', async (data, req) => {
    data.req = reporter.Request(data.req)
    await reporter.validateRenderListeners.fire(data.req, data.res)
    return { req: data.req, res: data.res }
  })
  reporter.registerMainAction('test-afterTemplatingEnginesExecuted-listeners', async (data, req) => {
    data.req = reporter.Request(data.req)
    await reporter.afterTemplatingEnginesExecutedListeners.fire(data.req, data.res)
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
