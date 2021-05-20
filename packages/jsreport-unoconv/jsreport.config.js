
module.exports = {
  name: 'unoconv',
  main: 'lib/main.js',
  worker: 'lib/worker.js',
  optionsSchema: {
    extensions: {
      unoconv: {
        type: 'object',
        properties: {
          command: { type: 'string', default: 'unoconv' }
        }
      }
    }
  },
  dependencies: ['templates', 'assets']
}
