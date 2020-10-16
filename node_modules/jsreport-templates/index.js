var main = require('./lib/templates.js')
var config = require('./jsreport.config.js')

module.exports = function (options) {
  config.options = options
  config.directory = __dirname
  config.main = main
  return config
}
