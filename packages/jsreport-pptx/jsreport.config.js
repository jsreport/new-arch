const office = require('jsreport-office')

module.exports = {
  'name': 'pptx',
  'main': 'lib/pptx.js',
  'optionsSchema': office.extendSchema('pptx', {
    type: 'object',
    properties: {
      beta: {
        type: 'object',
        properties: {
          showWarning: { type: 'boolean', default: true }
        }
      }
    }
  }),
  'dependencies': ['assets']
}
