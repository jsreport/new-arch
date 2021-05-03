const jsreport = require('jsreport-proxy')
const Handlebars = require('handlebars')
const commonHelpers = await jsreport.assets.require('../shared/common helpers.js')

commonHelpers(Handlebars)

function getPageNumber (pageIndex) {
    if (pageIndex == null) {
        return ''
    }

    const pageNumber = pageIndex + 1

    return pageNumber
}

function getTotalPages (pages) {
    if (!pages) {
        return ''
    }

    return pages.length
}
