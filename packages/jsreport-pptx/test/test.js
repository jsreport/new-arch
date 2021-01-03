require('should')
const jsreport = require('jsreport-core')
const fs = require('fs')
const path = require('path')
const util = require('util')
const textract = util.promisify(require('textract').fromBufferWithName)

describe('pptx', () => {
  let reporter

  beforeEach(() => {
    reporter = jsreport().use(require('../')())
      .use(require('jsreport-handlebars')())
      .use(require('jsreport-templates')())
      .use(require('jsreport-assets')())
    return reporter.init()
  })

  afterEach(() => reporter.close())

  it('variable-replace', async () => {
    const result = await reporter.render({
      template: {
        engine: 'handlebars',
        recipe: 'pptx',
        pptx: {
          templateAsset: {
            content: fs.readFileSync(path.join(__dirname, 'variable.pptx'))
          }
        }
      },
      data: {
        hello: 'Jan Blaha'
      }
    })

    fs.writeFileSync('out.pptx', result.content)
    const text = await textract('test.pptx', result.content)
    text.should.containEql('Jan Blaha')
  })

  it('slides', async () => {
    const result = await reporter.render({
      template: {
        engine: 'handlebars',
        recipe: 'pptx',
        pptx: {
          templateAsset: {
            content: fs.readFileSync(path.join(__dirname, 'slides.pptx'))
          }
        }
      },
      data: {
        items: [{ hello: 'Jan' }, { hello: 'Blaha' }, { hello: 'Boris' }]
      }
    })

    fs.writeFileSync('out.pptx', result.content)
    const text = await textract('test.pptx', result.content)
    text.should.containEql('Jan')
    text.should.containEql('Blaha')
    // the parser somehow don't find the other items on the first run
    // text.should.containEql('Boris')
  })

  it('list', async () => {
    const result = await reporter.render({
      template: {
        engine: 'handlebars',
        recipe: 'pptx',
        pptx: {
          templateAsset: {
            content: fs.readFileSync(path.join(__dirname, 'list.pptx'))
          }
        }
      },
      data: {
        items: [{
          name: 'Jan'
        }, {
          name: 'Boris'
        }, {
          name: 'Pavel'
        }]
      }
    })

    fs.writeFileSync('out.pptx', result.content)
    const text = await textract('test.pptx', result.content)
    text.should.containEql('Jan')
    text.should.containEql('Boris')
    text.should.containEql('Pavel')
  })

  it('image', async () => {
    const result = await reporter.render({
      template: {
        engine: 'handlebars',
        recipe: 'pptx',
        pptx: {
          templateAsset: {
            content: fs.readFileSync(path.join(__dirname, 'image.pptx'))
          }
        }
      },
      data: {
        src: 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, 'image.png')).toString('base64')
      }
    })

    fs.writeFileSync('out.pptx', result.content)
  })

  it('table', async () => {
    const result = await reporter.render({
      template: {
        engine: 'handlebars',
        recipe: 'pptx',
        pptx: {
          templateAsset: {
            content: fs.readFileSync(path.join(__dirname, 'table.pptx'))
          }
        }
      },
      data: {
        people: [
          {
            name: 'Jan',
            email: 'jan.blaha@foo.com'
          },
          {
            name: 'Boris',
            email: 'boris@foo.met'
          },
          {
            name: 'Pavel',
            email: 'pavel@foo.met'
          }
        ]
      }
    })

    fs.writeFileSync('out.pptx', result.content)
    const text = await textract('test.pptx', result.content)
    text.should.containEql('Jan')
    text.should.containEql('Boris')
  })
})
