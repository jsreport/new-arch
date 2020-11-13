const main = require('./lib/main.js')
const config = require('./jsreport.config.js')

module.exports = function (options) {
  config.options = options
  config.directory = __dirname
  config.main = main
  return config
}
