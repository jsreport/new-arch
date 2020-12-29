
module.exports = (reporter, definition) => {
  reporter.express = {}
  reporter.addRequestContextMetaConfig('http', { sandboxReadOnly: true })
  reporter.addRequestContextMetaConfig('http.query', { sandboxReadOnly: true })

  if (!definition.options.exposeHttpHeaders) {
    reporter.addRequestContextMetaConfig('http.headers', { sandboxHidden: true })
  } else {
    reporter.addRequestContextMetaConfig('http.headers', { sandboxReadOnly: true })
  }

  reporter.initializeListeners.add(definition.name, async () => {
    reporter.beforeRenderListeners.insert(0, 'express', (req, res) => {
      res.meta.headers = {}
    })
  })
}
