/*!
 * Copyright(c) 2017 Jan Blaha
 *
 * Recipe rendering pdf files using headless chrome.
 */
const dedicatedProcessStrategy = require('./dedicatedProcessStrategy')
const chromePoolStrategy = require('./chromePoolStrategy')

async function renderHeaderOrFooter (type, reporter, req, content) {
  reporter.logger.debug(`Starting child request to render pdf ${type}`, req)

  // do an anonymous render
  const template = {
    content,
    engine: req.template.engine,
    recipe: 'html',
    helpers: req.template.helpers
  }

  const res = await reporter.render({
    template
  }, req)

  return res.content.toString()
}

function execute (reporter, puppeteer, definition, strategyCall, imageExecution) {
  const strategy = definition.options.strategy
  const allowLocalFilesAccess = definition.options.allowLocalFilesAccess

  return async (req, res) => {
    const launchOptions = Object.assign({}, definition.options.launchOptions)

    const chrome = Object.assign({}, imageExecution ? req.template.chromeImage : req.template.chrome)

    let htmlUrl

    if (chrome.url) {
      htmlUrl = chrome.url
    } else {
      const { pathToFile: htmlPath } = await reporter.writeTempFile((uuid) => `${uuid}-${imageExecution ? 'chrome-image' : 'chrome-pdf'}.html`, res.content.toString())

      // when running docker on windows host the isAbsolute is not able to correctly determine
      // if path is absolute
      // if (!path.isAbsolute(htmlPath)) {
      //  throw new Error(`generated htmlPath option must be an absolute path to a file. path: ${htmlPath}`)
      // }

      // remove trailing slashes and change windows path separator to slash
      // use pathToFileURL in v3 and node 14
      htmlUrl = `file:///` + htmlPath.replace(/^\/+/, '').replace(/\\/g, '/')
    }

    if (!imageExecution) {
      if (chrome.headerTemplate) {
        chrome.headerTemplate = await renderHeaderOrFooter('header', reporter, req, chrome.headerTemplate)
      }

      if (chrome.footerTemplate) {
        chrome.footerTemplate = await renderHeaderOrFooter('footer', reporter, req, chrome.footerTemplate)
      }
    }

    const result = await strategyCall({
      htmlUrl,
      strategy,
      puppeteer,
      launchOptions,
      allowLocalFilesAccess,
      req,
      conversionOptions: chrome,
      imageExecution
    })

    res.content = result.content

    if (imageExecution) {
      res.meta.contentType = `image/${result.type}`
      res.meta.fileExtension = result.type
    } else {
      res.meta.contentType = 'application/pdf'
      res.meta.fileExtension = 'pdf'
    }
  }
}

module.exports = function (reporter, definition) {
  const puppeteer = definition.options.puppeteerInstance != null ? definition.options.puppeteerInstance : require('puppeteer')

  let strategyCall

  if (definition.options.strategy === 'dedicated-process') {
    strategyCall = dedicatedProcessStrategy({ reporter, puppeteer, options: definition.options })
  } else if (definition.options.strategy === 'chrome-pool') {
    strategyCall = chromePoolStrategy({ reporter, puppeteer, options: definition.options })
  }

  reporter.extensionsManager.recipes.push({
    name: 'chrome-pdf',
    execute: execute(reporter, puppeteer, definition, strategyCall)
  })

  reporter.extensionsManager.recipes.push({
    name: 'chrome-image',
    execute: execute(reporter, puppeteer, definition, strategyCall, true)
  })

  reporter.closeListeners.add('chrome', async () => {
    await strategyCall.kill()
  })
}
