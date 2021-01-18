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
  'jsreport-studio',
  'jsreport-scheduling',
  'jsreport-templates',
  'jsreport-text',
  'jsreport-version-control',
  'jsreport-xlsx'
]

for (const pd of jsreportPackages) {
  execSync(`yarn workspace ${pd} test`, {
    stdio: 'inherit'
  })
}
