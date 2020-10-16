/*!
 * Copyright(c) 2014 Jan Blaha
 */

const path = require('path')

module.exports = function (reporter, definition) {
  reporter.extensionsManager.engines.push({
    name: 'jsrender',
    pathToEngine: path.join(__dirname, './jsrenderEngine.js')
  })
}
