
const schema = {
  type: 'string'
}

module.exports = {
  'name': 'licensing',
  'main': 'lib/licensing.js',
  'optionsSchema': {
    'license-key': { ...schema },
    licenseKey: { ...schema },
    extensions: {
      'licensing': {
        type: 'object',
        properties: {
          useSavedLicenseInfo: { type: 'boolean' },
          licensingServerUrl: { type: 'string', default: 'https://jsreportonline.net/license-key' }
        }
      }
    }
  },
  'dependencies': ['templates'],
  'skipInExeRender': true
}
