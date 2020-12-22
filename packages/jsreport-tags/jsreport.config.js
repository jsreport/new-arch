
module.exports = {
  name: 'tags',
  main: './lib/tags.js',
  'optionsSchema': {
    extensions: {
      tags: {
        type: 'object',
        properties: {
          organizeByDefault: {
            type: 'boolean'
          }
        }
      }
    }
  }
}
