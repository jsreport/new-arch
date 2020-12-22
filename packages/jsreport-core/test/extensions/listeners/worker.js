module.exports = (reporter, definition) => {
  // intentionally at the end
  reporter.initializeListeners.add('test-listeners', () => {
    reporter.beforeRenderListeners.add('listeners', (req, res) => {
      return reporter.executeActionInMain('test-listeners', {}, req)
    })
  })
}
