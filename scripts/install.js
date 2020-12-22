const fs = require('fs')
const path = require('path')
const execSync = require('child_process').execSync

const jsreportPackages = fs.readdirSync(path.join(__dirname, '../', 'packages'))

for (const pd of jsreportPackages) {
  console.log('npm i in ' + path.join(__dirname, '../', 'packages', pd))
  execSync('npm i --production', {
    cwd: path.join(__dirname, '../', 'packages', pd)
  })
}
