const fs = require('fs')
const path = require('path')
const execSync = require('child_process').execSync

const jsreportPackages = ['jsreport-authentication', 'jsreport-templates']
// fs.readdirSync(path.join(__dirname, '../', 'packages'))

for (const pd of jsreportPackages) {
  console.log('npm i in ' + path.join(__dirname, '../', 'packages', pd))
  fs.rmdirSync(path.join(__dirname, '../', 'packages', pd, 'node_modules'), { recursive: true })
  fs.unlinkSync(path.join(__dirname, '../', 'packages', pd, 'package-lock.json'))
  execSync('npm i', {
    cwd: path.join(__dirname, '../', 'packages', pd)
  })
  console.log('npm test in ' + path.join(__dirname, '../', 'packages', pd))
  execSync('npm test', {
    cwd: path.join(__dirname, '../', 'packages', pd)
  })
}
