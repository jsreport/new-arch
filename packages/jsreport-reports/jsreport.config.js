
module.exports = {
  'name': 'reports',
  'main': 'lib/main.js',
  'worker': 'lib/worker.js',
  'dependencies': ['templates'],
  'optionsSchema': {
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
