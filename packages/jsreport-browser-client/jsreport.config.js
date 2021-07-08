
module.exports = {
  name: 'browser-client',
  main: 'lib/browser.js',
  optionsSchema: {
    extensions: {
      'browser-client': {
        type: 'object',
        properties: {
          scriptLinkRootPath: { type: 'string' }
        }
      }
    }
  },
  dependencies: [],
  requires: {
    core: '2.x.x',
    studio: '2.x.x'
  }
}
