const ListenerCollection = require('listener-collection')

module.exports = (reporter, definition) => {
  reporter.beforeRenderListeners = new ListenerCollection()
  reporter.afterRenderListeners = new ListenerCollection()
  reporter.validateRenderListeners = new ListenerCollection()
  reporter.afterTemplatingEnginesExecutedListeners = new ListenerCollection()

  reporter.registerMainAction('test-beforeRender-listeners', async (data, req) => {
    await reporter.beforeRenderListeners.fire(req)
    return req
  })
  reporter.registerMainAction('test-afterRender-listeners', async (data, req) => {
    await reporter.afterRenderListeners.fire(req)
    return req
  })
  reporter.registerMainAction('test-validateRender-listeners', async (data, req) => {
    await reporter.validateRenderListeners.fire(req)
    return req
  })
  reporter.registerMainAction('test-afterTemplatingEnginesExecuted-listeners', async (data, req) => {
    await reporter.afterTemplatingEnginesExecutedListeners.fire(req)
    return req
  })
}
