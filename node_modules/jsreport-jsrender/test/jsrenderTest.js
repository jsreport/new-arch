const should = require('should')
const jsrender = require('../lib/jsrenderEngine')

describe('jsrender', () => {
  it('should render html', function () {
    const html = jsrender('Hey')(null, null)
    html.should.be.eql('Hey')
  })

  it('should be able to use helpers', () => {
    const html = jsrender('{{>~a()}}')({ a: function () { return 'Hey' } }, null)
    html.should.be.eql('Hey')
  })

  it('should be able to use data', () => {
    const html = jsrender('{{:a}}')(null, { a: 'Hey' })
    html.should.be.eql('Hey')
  })

  it('should throw when missing helper', () => {
    should(() => {
      jsrender('{{:~missing()}}')(null, {})
    }).throw()
  })

  it('should throw when syntax error', () => {
    should(() => {
      jsrender('{{:~missing()}}')(null, {})
    }).throw()
  })

  it('should throw when use constr expression', () => {
    should(() => {
      jsrender('{{:#tmpl.constructor("var foo=3;")()}}')(null, {})
    }).throw()
  })

  it('should be able to parse and use sub tempates', () => {
    const childTemplate = '<script id="inner" type="text/x-jsrender">{{:#data}}</script>'
    const template = '{{for items tmpl="inner"}}{{/for}}'
    const html = jsrender(childTemplate + template)(null, { items: [1, 2, 3] })
    html.should.be.eql('123')
  })

  it('should be able to parse and use multiple sub tempates', () => {
    const childTemplate = '<script id="inner" type="text/x-jsrender">{{:#data}}</script>\n<script id="inner2" type="text/x-jsrender">a{{:#data}}</script>'
    const template = '{{for items tmpl="inner"}}{{/for}}{{for items tmpl="inner2"}}{{/for}}'
    const html = jsrender(childTemplate + template)(null, { items: [1, 2, 3] })
    html.should.be.eql('\n123a1a2a3')
  })

  it('should be able to use custom tag', () => {
    const html = jsrender('{{customTag}}{{:a}}{{/customTag}}')({
      customTag: function () {
        return this.tagCtx.render(this.tagCtx.view.data)
      }
    }, { a: 'Hey' })
    html.should.be.eql('Hey')
  })

  it('should be able to use custom tag inside for loop', () => {
    const html = jsrender('{{for people}}{{customTag}}{{:name}}{{/customTag}}{{/for}}')({
      customTag: function () {
        return this.tagCtx.render(this.tagCtx.view.data)
      }
    }, { people: [{ name: 'Jan' }] })
    html.should.be.eql('Jan')
  })

  it('should clean tags after render', () => {
    jsrender('{{customTag}}{{:a}}{{/customTag}}')({
      customTag: function () {
        return this.tagCtx.render(this.tagCtx.view.data) + 'x'
      }
    }, { a: 'Heyx' })

    const html = jsrender('{{customTag}}{{:a}}{{/customTag}}')({}, { a: 'Hey' })

    html.should.not.be.eql('Heyx')
  })
})
