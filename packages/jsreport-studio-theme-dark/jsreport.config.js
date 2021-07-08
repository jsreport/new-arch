
module.exports = {
  name: 'studio-theme-dark',
  main: './lib/main.js',
  dependencies: ['express', 'studio'],
  requires: {
    core: '2.x.x',
    studio: '2.x.x'
  },
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
