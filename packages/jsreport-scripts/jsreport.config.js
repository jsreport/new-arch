
module.exports = {
  name: 'scripts',
  main: 'lib/main.js',
  worker: 'lib/worker.js',
  optionsSchema: {
    extensions: {
      scripts: {
        type: 'object',
        properties: {
          timeout: { type: 'number' },
          allowedModules: {
            anyOf: [{
              type: 'string',
              '$jsreport-constantOrArray': ['*']
            }, {
              type: 'array',
              items: { type: 'string' }
            }]
          }
        }
      }
    }
  },
  dependencies: ['templates', 'data'],
  embeddedSupport: true
}