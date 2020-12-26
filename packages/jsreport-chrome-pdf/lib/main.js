/*!
 * Copyright(c) 2017 Jan Blaha
 *
 * Recipe rendering pdf files using headless chrome.
 */

const os = require('os')
const numCPUs = os.cpus().length

module.exports = function (reporter, definition) {
  const versionSupported = /^2/

  if (!versionSupported.test(reporter.version)) {
    throw new Error(`${definition.name} extension version currently installed can only be used in jsreport v2, your current jsreport installation (${
      reporter.version
    }) is incompatible with this extension. please downgrade ${definition.name} extension to a version which works with jsreport ${
      reporter.version
    } or update jsreport to v2`)
  }

  definition.options = Object.assign({}, reporter.options.chrome, definition.options)

  if (definition.options.allowLocalFilesAccess == null) {
    definition.options.allowLocalFilesAccess = reporter.options.allowLocalFilesAccess
  }

  let timeoutProp

  if (definition.options.timeout != null) {
    if (reporter.options.chrome && reporter.options.chrome.timeout != null) {
      timeoutProp = 'chrome.timeout'
    } else {
      timeoutProp = 'extensions.chrome-pdf.timeout'
    }
  }

  if (definition.options.timeout != null && reporter.options.reportTimeout != null) {
    reporter.logger.warn(`"${timeoutProp}" configuration is ignored when "reportTimeout" is set`)
  } else if (definition.options.timeout != null) {
    reporter.logger.warn(`"${timeoutProp}" configuration is deprecated and will be removed in the future, please use "reportTimeout" instead`)
  }

  if (definition.options.launchOptions == null) {
    definition.options.launchOptions = {}
  }

  if (definition.options.timeout == null) {
    definition.options.timeout = 30000
  }

  if (definition.options.strategy == null) {
    definition.options.strategy = 'dedicated-process'
  }

  if (
    definition.options.strategy !== 'dedicated-process' &&
    definition.options.strategy !== 'chrome-pool'
  ) {
    throw new Error(`Unsupported strategy "${definition.options.strategy}" for chrome-pdf`)
  }

  if (definition.options.numberOfWorkers == null) {
    definition.options.numberOfWorkers = numCPUs
  }

  if (definition.options.strategy === 'chrome-pool') {
    reporter.logger.debug(`Chrome strategy is ${definition.options.strategy}, numberOfWorkers: ${definition.options.numberOfWorkers}`)
  } else {
    reporter.logger.debug(`Chrome strategy is ${definition.options.strategy}`)
  }

  if (definition.options.launchOptions && Object.keys(definition.options.launchOptions).length > 0) {
    reporter.logger.debug('Chrome custom launch options are', definition.options.launchOptions)
  }

  reporter.extensionsManager.recipes.push({
    name: 'chrome-pdf'
  })

  reporter.extensionsManager.recipes.push({
    name: 'chrome-image'
  })

  reporter.documentStore.registerComplexType('ChromeType', {
    url: { type: 'Edm.String' },
    scale: { type: 'Edm.Decimal', schema: { type: 'null' } },
    displayHeaderFooter: { type: 'Edm.Boolean' },
    printBackground: { type: 'Edm.Boolean' },
    landscape: { type: 'Edm.Boolean' },
    pageRanges: { type: 'Edm.String' },
    format: { type: 'Edm.String' },
    width: { type: 'Edm.String' },
    height: { type: 'Edm.String' },
    marginTop: { type: 'Edm.String' },
    marginRight: { type: 'Edm.String' },
    marginBottom: { type: 'Edm.String' },
    marginLeft: { type: 'Edm.String' },
    mediaType: { type: 'Edm.String' },
    waitForJS: { type: 'Edm.Boolean' },
    waitForNetworkIddle: { type: 'Edm.Boolean' },
    headerTemplate: { type: 'Edm.String', document: { extension: 'html', engine: true } },
    footerTemplate: { type: 'Edm.String', document: { extension: 'html', engine: true } }
  })

  reporter.documentStore.registerComplexType('ChromeImageType', {
    url: { type: 'Edm.String' },
    type: { type: 'Edm.String' },
    quality: { type: 'Edm.Decimal', schema: { type: 'null' } },
    fullPage: { type: 'Edm.Boolean' },
    clipX: { type: 'Edm.Decimal', schema: { type: 'null' } },
    clipY: { type: 'Edm.Decimal', schema: { type: 'null' } },
    clipWidth: { type: 'Edm.Decimal', schema: { type: 'null' } },
    clipHeight: { type: 'Edm.Decimal', schema: { type: 'null' } },
    omitBackground: { type: 'Edm.Boolean' },
    mediaType: { type: 'Edm.String' },
    waitForJS: { type: 'Edm.Boolean' },
    waitForNetworkIddle: { type: 'Edm.Boolean' }
  })

  if (reporter.documentStore.model.entityTypes['TemplateType']) {
    reporter.documentStore.model.entityTypes['TemplateType'].chrome = { type: 'jsreport.ChromeType' }
    reporter.documentStore.model.entityTypes['TemplateType'].chromeImage = { type: 'jsreport.ChromeImageType' }
  }
}
