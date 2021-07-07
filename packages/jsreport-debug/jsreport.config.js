
module.exports = {
  name: 'debug',
  main: 'lib/debug.js',
  optionsSchema: {
    extensions: {
      debug: {
        type: 'object',
        properties: {
          maxLogResponseHeaderSize: { type: 'number' }
        }
      }
    }
  },
  dependencies: [],
  requires: {
    core: '2.x.x',
    studio: '2.x.x'
  },
  skipInExeRender: true
}
