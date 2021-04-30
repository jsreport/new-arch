
module.exports = {
  name: 'sample-template',
  main: 'lib/sample.js',
  optionsSchema: {
    extensions: {
      'sample-template': {
        type: 'object',
        properties: {
          createSamples: { type: 'boolean' },
          skipCreateSamplesModal: { type: 'boolean', default: false },
          forceCreation: { type: 'boolean' }
        }
      }
    }
  },
  dependencies: ['data', 'chrome-pdf'],
  hasPublicPart: false,
  skipInExeRender: true
}
