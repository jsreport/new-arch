
module.exports = {
  'name': 'freeze',
  'main': 'lib/freeze.js',
  'optionsSchema': {
    extensions: {
      freeze: {
        type: 'object',
        properties: {
          hardFreeze: { type: 'boolean' }
        }
      }
    }
  }
}
