
module.exports = {
  'name': 'base',
  'main': 'lib/base.js',
  'optionsSchema': {
    extensions: {
      base: {
        type: 'object',
        properties: {
          url: { type: 'string' }
        }
      }
    }
  },
  'dependencies': ['templates'],
  'hasPublicPart': false
}
