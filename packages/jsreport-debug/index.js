var main = require('./lib/debug.js')
var config = require('./jsreport.config.js')

module.exports = function (options) {
  config.options = options
  config.main = main
  config.directory = __dirname
  return config
}
