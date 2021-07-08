
module.exports = {
  name: 'base',
  main: 'lib/main.js',
  worker: 'lib/worker.js',
  optionsSchema: {
    extensions: {
      base: {
        type: 'object',
        properties: {
          url: { type: 'string' }
        }
      }
    }
  },
  dependencies: [],
  requires: {
    core: '2.x.x'
  },
  hasPublicPart: false
}
