
module.exports = {
  name: 'studio-theme-dark',
  main: './lib/main.js',
  dependencies: ['express', 'studio'],
  optionsSchema: {
    extensions: {
      studio: {
        type: 'object',
        properties: {
          theme: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                enum: ['dark']
              }
            }
          }
        }
      }
    }
  }
}
