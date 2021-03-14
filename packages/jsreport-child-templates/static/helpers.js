/* eslint no-unused-vars: 0 */
/* eslint no-new-func: 0 */
/* *global __rootDirectory */

function childTemplateSerializeData (data) {
  return Buffer.from(JSON.stringify(data)).toString('base64')
}

function childTemplateParseData (dataStr) {
  return JSON.parse(Buffer.from(dataStr, 'base64').toString())
}

async function childTemplate (templateNameOrObject, data, options, opts) {
  let jsreport = require('jsreport-proxy')
  const res = await jsreport.render({
    template: typeof templateNameOrObject === 'string' ? {
      name: templateNameOrObject
    } : templateNameOrObject,
    data,
    options
  })
  return res.content.toString()
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports.childTemplateSerializeData = childTemplateSerializeData
  module.exports.childTemplateParseData = childTemplateParseData
}
