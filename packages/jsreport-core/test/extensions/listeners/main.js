const ListenerCollection = require('listener-collection')

module.exports = (reporter, definition) => {
  reporter.beforeRenderListeners = new ListenerCollection()
  reporter.registerMainAction('test-listeners', (data, req) => reporter.beforeRenderListeners.fire(req))
}
