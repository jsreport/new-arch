/* eslint no-unused-vars: 1 */
/* eslint no-new-func: 0 */
/* *global __rootDirectory */
;(function (global) {
  const Handlebars = require('handlebars')

  global.pptxList = function (data, options) {
    return Handlebars.helpers.each(data, options)
  }

  global.pptxTable = function (data, options) {
    return Handlebars.helpers.each(data, options)
  }

  global.pptxSlides = function (data, options) {
    return Handlebars.helpers.each(data, options)
  }

  global.pptxImage = function (options) {
    return new Handlebars.SafeString(`<pptxImage src="${options.hash.src}" />`)
  }
})(this)
