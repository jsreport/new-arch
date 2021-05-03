const conversion = require('./conversion')

module.exports = ({ reporter, puppeteer, options }) => {
  let openedBrowsers = []
  const execute = async ({ htmlUrl, strategy, launchOptions, conversionOptions, req, imageExecution, allowLocalFilesAccess }) => {
    let browser

    try {
      const result = await conversion({
        reporter,
        getBrowser: async () => {
          browser = await puppeteer.launch(launchOptions)
          openedBrowsers.push(browser)
          return browser
        },
        htmlUrl,
        strategy,
        req,
        timeout: reporter.options.reportTimeout,
        allowLocalFilesAccess,
        imageExecution,
        options: conversionOptions
      })

      return {
        type: result.type,
        content: result.content
      }
    } finally {
      if (browser) {
        try {
          let pages = await browser.pages()
          await Promise.all(pages.map(page => page.close()))
          await browser.close()
        } finally {
          openedBrowsers = openedBrowsers.filter(b => b !== browser)
        }
      }
    }
  }

  execute.kill = async () => {
    for (let browser of openedBrowsers) {
      try {
        let pages = await browser.pages()
        await Promise.all(pages.map(page => page.close()))
        await browser.close()
      } catch (e) {

      }
    }
  }

  return execute
}
