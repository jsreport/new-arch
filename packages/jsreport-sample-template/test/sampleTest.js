const samples = require('../')
const fsStore = require('jsreport-fs-store')
const templates = require('jsreport-templates')
const xlsx = require('jsreport-xlsx')
const htmlToXlsx = require('jsreport-html-to-xlsx')
const data = require('jsreport-data')
const scripts = require('jsreport-scripts')
const assets = require('jsreport-assets')
const handlebars = require('jsreport-handlebars')
const chromePdf = require('jsreport-chrome-pdf')
const pdfUtils = require('jsreport-pdf-utils')
const jsreport = require('jsreport-core')
const rimraf = require('rimraf')
const path = require('path')

describe('sample', function () {
  let reporter

  beforeEach(() => {
    rimraf.sync(path.join(__dirname, '../data'))
    reporter = jsreport({
      allowLocalFilesAccess: true,
      store: { provider: 'fs' },
      templatingEngines: { strategy: 'in-process' }
    })

    reporter.use(templates())
    reporter.use(data())
    reporter.use(xlsx())
    reporter.use(htmlToXlsx())
    reporter.use(scripts({ allowedModules: '*' }))
    reporter.use(assets())
    reporter.use(pdfUtils())
    reporter.use(handlebars())
    reporter.use(chromePdf({
      launchOptions: {
        args: ['--no-sandbox']
      }
    }))
    reporter.use(fsStore())
    reporter.use(samples({ createSamples: true }))

    return reporter.init()
  })

  afterEach(() => {
    return reporter.close()
  })

  it('should be able to render all sample templates', async () => {
    const reports = ['Invoice', 'Orders', 'Sales']

    for (const n of reports) {
      const folder = await reporter.folders.resolveFolderFromPath(`/samples/${n}/main`)
      const template = await reporter.documentStore.collection('templates').findOne({ name: `${n.toLowerCase()}-main`, folder: { shortid: folder.shortid } })
      await reporter.render({ template: { shortid: template.shortid } })
    }
  })
})
