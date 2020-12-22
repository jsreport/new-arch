/*!
 * Copyright(c) 2018 Jan Blaha
 *
 * Core extension responsible for storing, versioning and loading report templates for render req..
 */
const configureExpress = (reporter) => (app) => {
  app.get('/templates/:shortid', (req, res, next) => reporter.express.render({ template: { shortid: req.params.shortid } }, req, res, next))
}

module.exports = function (reporter, definition) {
  Object.assign(reporter.documentStore.model.entityTypes['TemplateType'], {
    name: { type: 'Edm.String', publicKey: true }
  })

  reporter.documentStore.registerEntitySet('templates', {
    entityType: 'jsreport.TemplateType',
    humanReadableKey: 'shortid',
    splitIntoDirectories: true
  })

  reporter.initializeListeners.add('templates', function () {
    var col = reporter.documentStore.collection('templates')

    if (reporter.express) {
      reporter.express.exposeOptionsToApi(definition.name, {
        'studio-link-button-visibility': definition.options['studio-link-button-visibility']
      })
    }

    col.beforeInsertListeners.add('templates', (doc) => {
      if (!doc.engine) {
        throw reporter.createError('Template must contain engine', {
          weak: true,
          statusCode: 400
        })
      }
      if (!doc.recipe) {
        throw reporter.createError('Template must contain recipe', {
          weak: true,
          statusCode: 400
        })
      }
    })
  })

  reporter.on('express-configure', configureExpress(reporter, definition))
}
