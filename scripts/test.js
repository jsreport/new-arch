const fs = require('fs')
const path = require('path')
const execSync = require('child_process').execSync

const jsreportPackages = [
  'jsreport-assets',
  'jsreport-authentication',
  'jsreport-authorization',
  'jsreport-base',
  'jsreport-core',
  'jsreport-data',
  'jsreport-docx',
  'jsreport-express',
  'jsreport-freeze',
  'jsreport-fs-store',
  'jsreport-handlebars',
  'jsreport-html-to-xlsx',
  'jsreport-child-templates',
  'jsreport-chrome-pdf',
  'jsreport-jsrender',
  'jsreport-pdf-utils',
  'jsreport-scripts',
  'jsreport-studio',
  'jsreport-scheduling',
  'jsreport-templates',
  'jsreport-text',
  'jsreport-xlsx'
]
// fs.readdirSync(path.join(__dirname, '../', 'packages'))

for (const pd of jsreportPackages) {
  fs.rmdirSync(path.join(__dirname, '../', 'packages', pd, 'node_modules'), { recursive: true })
  if (fs.existsSync(path.join(__dirname, '../', 'packages', pd, 'package-lock.json'))) {
    fs.unlinkSync(path.join(__dirname, '../', 'packages', pd, 'package-lock.json'))
  }

  const install = () => execSync('npm i', {
    cwd: path.join(__dirname, '../', 'packages', pd),
    stdio: 'inherit'
  })

  try {
    install()
  } catch (e) {
    install()
  }
}

for (const pd of jsreportPackages) {
  console.log('npm test in ' + path.join(__dirname, '../', 'packages', pd))

  execSync('npm test', {
    cwd: path.join(__dirname, '../', 'packages', pd),
    stdio: 'inherit'
  })
}
