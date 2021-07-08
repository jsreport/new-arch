
module.exports = {
  name: 'reports',
  main: 'lib/main.js',
  worker: 'lib/worker.js',
  dependencies: [],
  requires: {
    core: '2.x.x',
    studio: '2.x.x'
  },
  optionsSchema: {
    extensions: {
      reports: {
        type: 'object',
        properties: {
          cleanInterval: {
            type: ['string', 'number'],
            '$jsreport-acceptsDuration': true
          },
          cleanThreshold: {
            type: ['string', 'number'],
            '$jsreport-acceptsDuration': true
          }
        }
      }
    }
  }
}
