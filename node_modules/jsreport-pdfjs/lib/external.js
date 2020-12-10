'use strict'

const PDF = require('./object')
const Parser = require('./parser/parser')

module.exports = class ExternalDocument {
  constructor(src) {
    const parser = new Parser(src)
    parser.parse()

    this.catalog = parser.trailer.get('Root').object.properties
    const pagesList = []

    this.pages = this.catalog.get('Pages').object.properties
    this.pageCount = 0
    this.objects = []
    this.dests = this.catalog.get('Dests')

    const parsePages = (pages) => {
      for (const kid of pages.get('Kids')) {
        if (kid.object.properties instanceof PDF.Dictionary && kid.object.properties.get('Type').name === 'Pages') {
          parsePages(kid.object.properties)
        } else {
          kid.object.properties.del('Parent')

          const objects = []
          Parser.addObjectsRecursive(objects, kid.object)

          this.objects.push(objects)
          this.pageCount++
          pagesList.push(kid)
        }
      }
    }

    parsePages(this.catalog.get('Pages').object.properties)
    this.pages.set('Kids', pagesList)
  }

  // TODO: add mutex to not write concurrently (because of document specific _registerObject)
  async write(doc, page) { 
    await doc._endPage()

    const kids = this.pages.get('Kids')
    const pages = page ? [kids[page - 1]] : kids

    for (let i = page ? page - 1 : 0, len = page ? page : kids.length; i < len; ++i) {
      const page = kids[i].object
      const objects = this.objects[i]

      // JB change, removed force register to avoid duplicating fonts in the final document
      doc._registerObject(page)

      // first, register objects to assign IDs (for references)
      for (const obj of objects) {
        // JB change, removed force register to avoid duplicating fonts in the final document
        doc._registerObject(obj)
      }

      // write objects
      for (const obj of objects) {
        await doc._writeObject(obj)
      }

      page.prop('Parent', doc._pagesObj.toReference())
      await doc._writeObject(page)

      doc._pages.push(page.toReference())
    }

    if (this.dests) {
      doc._destsObject = this.dests.object
    }
  }

  async setAsTemplate(doc) {
    await doc._endPage()

    const kids = this.pages.get('Kids')
    if (!kids[0]) {
      throw new TypeError('External document is invalid')
    }
    const first = kids[0].object.properties
    const objects = this.objects[0]

    // first, register objects to assign IDs (for references)
    for (const obj of objects) {
      doc._registerObject(obj, true)
    }

    // write objects
    for (const obj of objects) {
      await doc._writeObject(obj)
    }

    let contents = first.get('Contents')
    if (!Array.isArray(contents)) {
      contents = [contents]
    }

    let resources = first.get('Resources')
    if (resources instanceof PDF.Reference) {
      resources = resources.object.properties
    }

    doc._template = {
      contents: contents.map(c => c.toString()),
      colorSpaces: {},
      fonts: {},
      xobjects: {},
    }

    const colorSpaces = resources.get('ColorSpace')
    if (colorSpaces) {
      for (const alias in colorSpaces.dictionary) {
        doc._template.colorSpaces[alias] = colorSpaces.dictionary[alias].toString()
        doc._aliases.block(alias)
      }
    }

    const fonts = resources.get('Font')
    if (fonts) {
      for (const alias in fonts.dictionary) {
        doc._template.fonts[alias] = fonts.dictionary[alias].toString()
        doc._aliases.block(alias)
      }
    }

    const xobjects = resources.get('XObject')
    if (xobjects) {
      for (const alias in xobjects.dictionary) {
        doc._template.xobjects[alias] = xobjects.dictionary[alias].toString()
        doc._aliases.block(alias)
      }
    }
  }
}
