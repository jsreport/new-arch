
module.exports = {
  name: 'templates',
  main: 'lib/main.js',
  worker: 'lib/worker.js',
  embeddedSupport: true,
  optionsSchema: {
    extensions: {
      templates: {
        type: 'object',
        properties: {
          'studio-link-button-visibility': {
            type: 'boolean'
          }
        }
      }
    }
  }
}
