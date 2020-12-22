/*!
 * Copyright(c) 2018 Jan Blaha
 *
 * text recipe simply just evaluates engines and return the defined content type.
 */

module.exports = (reporter, definition) => {
  reporter.documentStore.model.entityTypes['TemplateType'].contentType = { type: 'Edm.String' }
  reporter.documentStore.model.entityTypes['TemplateType'].fileExtension = { type: 'Edm.String' }
  reporter.documentStore.model.entityTypes['TemplateType'].contentDisposition = { type: 'Edm.String' }

  reporter.extensionsManager.recipes.push({
    name: 'text',
    execute: (request, response) => {
      response.meta.contentType = request.template.contentType || 'text/plain'
      response.meta.fileExtension = request.template.fileExtension || '.txt'

      const contentDisposition = request.template.contentDisposition || 'inline'
      response.meta.contentDisposition = contentDisposition + (
        contentDisposition.indexOf(';') !== -1 ? '' : ';filename=report.' + response.meta.fileExtension)
    }
  })
}
