function asset (path, encoding = 'utf8') {
  const jsreport = require('jsreport-proxy')
  return jsreport.assets.read(path, encoding)
}
