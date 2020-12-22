
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
  skipInExeRender: true
}
