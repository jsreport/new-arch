const main = require('./lib/main.js')
const config = require('./jsreport.config.js')

module.exports = (options) => {
  config.options = options
  config.main = main
  config.directory = __dirname
  return config
}
