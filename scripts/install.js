const fs = require('fs')
const path = require('path')
const execSync = require('child_process').execSync

const jsreportPackages = fs.readdirSync(path.join(__dirname, '../', 'packages'))

for (const pd of jsreportPackages) {
  console.log('npm i in ' + path.join(__dirname, '../', 'packages', pd))
  fs.rmdirSync(path.join(__dirname, '../', 'packages', pd, 'node_modules'), { recursive: true })
  if (fs.existsSync(path.join(__dirname, '../', 'packages', pd, 'package-lock.json'))) {
    fs.unlinkSync(path.join(__dirname, '../', 'packages', pd, 'package-lock.json'))
  }
  execSync('npm i --production', {
    cwd: path.join(__dirname, '../', 'packages', pd),
    stdio: 'inherit'
  })
}
