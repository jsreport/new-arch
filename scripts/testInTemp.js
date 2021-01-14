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
  'jsreport-pptx',
  'jsreport-reports',
  'jsreport-scripts',
  'jsreport-studio-dev',
  'jsreport-studio',
  'jsreport-scheduling',
  'jsreport-templates',
  'jsreport-text',
  'jsreport-version-control',
  'jsreport-xlsx'
]
// fs.readdirSync(path.join(__dirname, '../', 'packages'))

const appPath = path.join(__dirname, '../../', 'new-arch-temp')
fs.rmdirSync(appPath, { recursive: true })
fs.mkdirSync(appPath)

execSync('git clone https://github.com/jsreport/new-arch new-arch-temp', {
  cwd: path.join(__dirname, '../../'),
  stdio: 'inherit'
})

for (const pd of jsreportPackages) {
  fs.rmdirSync(path.join(appPath, 'packages', pd, 'node_modules'), { recursive: true })
  if (fs.existsSync(path.join(appPath, 'packages', pd, 'package-lock.json'))) {
    fs.unlinkSync(path.join(appPath, 'packages', pd, 'package-lock.json'))
  }

  const install = () => execSync('npm i', {
    cwd: path.join(appPath, 'packages', pd),
    stdio: 'inherit'
  })

  try {
    install()
  } catch (e) {
    install()
  }
}

for (const pd of jsreportPackages) {
  if (pd === 'jsreport-studio-dev') {
    continue
  }

  console.log('npm test in ' + path.join(appPath, 'packages', pd))

  const opts = {
    cwd: path.join(appPath, 'packages', pd),
    stdio: 'inherit'
  }

  if (pd === 'jsreport-studio') {
    opts.env = Object.assign({}, process.env, {
      NODE_PATH: path.join(appPath, 'packages/jsreport-studio-dev/node_modules')
    })
  }

  execSync('npm test', opts)
}
