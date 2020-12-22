const extend = require('node.extend.without.arrays')
module.exports = (reporter, definition) => {
  // intentionally at the end
  reporter.initializeListeners.add('test-listeners', () => {
    reporter.beforeRenderListeners.add('listeners', async (req, res) => {
      const resultReq = await reporter.executeActionInMain('test-beforeRender-listeners', {}, req)
      extend(true, req, resultReq)
    })

    reporter.afterRenderListeners.add('listeners', async (req, res) => {
      const resultReq = await reporter.executeActionInMain('test-afterRender-listeners', {}, req)
      extend(true, req, resultReq)
    })

    reporter.validateRenderListeners.add('listeners', async (req, res) => {
      const resultReq = await reporter.executeActionInMain('test-validateRender-listeners', {}, req)
      extend(true, req, resultReq)
    })
    reporter.afterTemplatingEnginesExecutedListeners.add('listeners', async (req, res) => {
      const resultReq = await reporter.executeActionInMain('test-afterTemplatingEnginesExecuted-listeners', {}, req)
      extend(true, req, resultReq)
    })
  })
}
