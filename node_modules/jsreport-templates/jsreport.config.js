
module.exports = {
  'name': 'templates',
  'main': 'lib/templates.js',
  'embeddedSupport': true,
  'optionsSchema': {
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
