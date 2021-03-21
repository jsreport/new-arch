
module.exports = {
  'name': 'azure-storage',
  'main': './lib/main.js',
  'dependencies': [],
  'optionsSchema': {
    blobStorage: {
      type: 'object',
      properties: {
        provider: { type: 'string', enum: ['azure-storage'] }
      }
    },
    extensions: {
      'azure-storage': {
        type: 'object',
        properties: {
          accountName: { type: 'string' },
          accountKey: { type: 'string' },
          container: { type: 'string' }
        }
      }
    }
  }
}
