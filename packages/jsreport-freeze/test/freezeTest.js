require('should')
const jsreport = require('jsreport-core')

describe('freeze', () => {
  let reporter

  beforeEach(() => {
    reporter = jsreport()
    reporter.use(require('../')())
    return reporter.init()
  })

  it('should allow iserts in default', async () => {
    return reporter.documentStore.collection('templates').insert({ name: 'foo', engine: 'none', recipe: 'html' })
  })

  it('should allow update in default', async () => {
    await reporter.documentStore.collection('templates').insert({ name: 'foo', engine: 'none', recipe: 'html' })
    return reporter.documentStore.collection('templates').update({ name: 'foo' }, { $set: { content: 'foo ' } })
  })

  it('should allow remove in default', async () => {
    await reporter.documentStore.collection('templates').insert({ name: 'foo', engine: 'none', recipe: 'html' })
    return reporter.documentStore.collection('templates').remove({ name: 'foo' })
  })

  it('should block iserts in freeze', async () => {
    await reporter.settings.addOrSet('freeze', true)
    return reporter.documentStore.collection('templates').insert({ name: 'foo', engine: 'none', recipe: 'html' }).should.be.rejectedWith(/frozen/)
  })

  it('should block update in freeze', async () => {
    await reporter.documentStore.collection('templates').insert({ name: 'foo', engine: 'none', recipe: 'html' })
    await reporter.settings.addOrSet('freeze', true)
    return reporter.documentStore.collection('templates').update({ name: 'foo' }, { $set: { content: 'foo' } }).should.be.rejectedWith(/frozen/)
  })

  it('should block remove in freeze', async () => {
    await reporter.documentStore.collection('templates').insert({ name: 'foo', engine: 'none', recipe: 'html' })
    await reporter.settings.addOrSet('freeze', true)
    return reporter.documentStore.collection('templates').remove({ name: 'foo' }).should.be.rejectedWith(/frozen/)
  })
})

describe('freeze with hardFreeze', () => {
  let reporter

  beforeEach(() => {
    reporter = jsreport()
    reporter.use(require('../')({ hardFreeze: true }))
    return reporter.init()
  })

  it('should block insert', async () => {
    return reporter.documentStore.collection('templates').insert({ name: 'foo', engine: 'none', recipe: 'html' }).should.be.rejectedWith(/frozen/)
  })
})
