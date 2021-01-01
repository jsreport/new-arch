const fs = require('fs')
const path = require('path')
const execSync = require('child_process').execSync

const jsreportPackages = [
  /* 'jsreport-assets',
  'jsreport-authentication',
  'jsreport-authorization',
  'jsreport-base', */
  'jsreport-core',
  /* 'jsreport-data',
  'jsreport-docx',
  'jsreport-express',
  'jsreport-fs-store', */
  'jsreport-handlebars',
  /* 'jsreport-child-templates', */
  'jsreport-chrome-pdf',
  /* 'jsreport-jsrender',
  'jsreport-pdf-utils',
  'jsreport-scripts',
  'jsreport-studio', */
  'jsreport-templates'
]
// fs.readdirSync(path.join(__dirname, '../', 'packages'))

for (const pd of jsreportPackages) {
  fs.rmdirSync(path.join(__dirname, '../', 'packages', pd, 'node_modules'), { recursive: true })
  if (fs.existsSync(path.join(__dirname, '../', 'packages', pd, 'package-lock.json'))) {
    fs.unlinkSync(path.join(__dirname, '../', 'packages', pd, 'package-lock.json'))
  }
  try {
    execSync('npm i', {
      cwd: path.join(__dirname, '../', 'packages', pd),
      stdio: 'inherit'
    })
  } catch (e) {
    execSync('npm i', {
      cwd: path.join(__dirname, '../', 'packages', pd),
      stdio: 'inherit'
    })
  }
}

for (const pd of jsreportPackages) {
  console.log('npm test in ' + path.join(__dirname, '../', 'packages', pd))
  execSync('npm test', {
    cwd: path.join(__dirname, '../', 'packages', pd),
    stdio: 'inherit'
  })
}
