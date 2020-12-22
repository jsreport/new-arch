const conversion = require('./conversion')

module.exports = ({ reporter, puppeteer, options }) => {
  const execute = async ({ htmlUrl, strategy, launchOptions, conversionOptions, req, imageExecution, allowLocalFilesAccess }) => {
    let browser

    try {
      const result = await conversion({
        reporter,
        getBrowser: async () => {
          browser = await puppeteer.launch(launchOptions)
          return browser
        },
        htmlUrl,
        strategy,
        req,
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
        await browser.close()
      }
    }
  }

  execute.kill = () => {}

  return execute
}
