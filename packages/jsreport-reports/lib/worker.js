const extend = require('node.extend.without.arrays')
const _omit = require('lodash.omit')

module.exports = (reporter, definition) => {
  reporter.beforeRenderListeners.insert(0, definition.name, async (request, response) => {
    if (request.options.reports == null || (request.options.reports.async !== true && request.options.reports.save !== true)) {
      return
    }

    // we don't want the report options to be applied in the nested requests, just in the end
    response.meta.reportsOptions = request.options.reports
    delete request.options.reports

    if (response.meta.reportsOptions.async) {
      const r = await reporter.documentStore.collection('reports').insert({
        name: response.meta.reportName,
        state: 'planned'
      }, request)

      if (request.context.http) {
        response.meta.headers.Location = `${request.context.http.baseUrl}/reports/${r._id}/status`
      }

      const asyncRequest = extend(true, {}, _omit(request, 'data'))

      // start a fresh context so we don't inherit logs, etc
      asyncRequest.context = extend(true, {}, _omit(asyncRequest.context, 'logs'))
      asyncRequest.options.reports = extend(true, {}, response.meta.reportsOptions)
      asyncRequest.options.reports.save = true

      if (!request.context.originalInputDataIsEmpty) {
        asyncRequest.data = request.data
      }

      asyncRequest.options.reports.async = false
      asyncRequest.options.reports._id = r._id

      request.options = {}

      // this request is now just returning status page, we don't want store blobs there
      delete response.meta.reportsOptions

      request.template = {
        content: "Async rendering in progress. Use Location response header to check the current status. Check it <a href='" + response.meta.headers.Location + "'>here</a>",
        engine: 'none',
        recipe: 'html'
      }

      reporter.logger.info('Rendering is queued for async report generation', request)

      process.nextTick(() => {
        reporter.logger.info(`Async report is starting to render ${asyncRequest.options.reports._id}`)

        reporter.render(asyncRequest).then(() => {
          reporter.logger.info(`Async report render finished ${asyncRequest.options.reports._id}`)
        }).catch((e) => {
          reporter.logger.error(`Async report render failed ${asyncRequest.options.reports._id}: ${e.stack}`)

          reporter.documentStore.collection('reports').update({
            _id: asyncRequest.options.reports._id
          }, {
            $set: {
              state: 'error',
              error: e.stack
            }
          }, request)
        })
      })
    }
  })

  reporter.initializeListeners.add(definition.name, () => {
    // we add here to be sure we are after scripts
    reporter.afterRenderListeners.add(definition.name, async (request, response) => {
      if (!response.meta.reportsOptions) {
        reporter.logger.debug('Skipping storing report.', request)
        return Promise.resolve()
      }

      const reportsOptions = response.meta.reportsOptions

      const report = Object.assign({}, reportsOptions.mergeProperties || {}, {
        recipe: request.template.recipe,
        name: response.meta.reportName,
        fileExtension: response.meta.fileExtension,
        templateShortid: request.template.shortid,
        creationDate: new Date(),
        contentType: response.meta.contentType,
        public: reportsOptions.public === true
      })

      if (!response.meta.reportsOptions._id) {
        report._id = await reporter.documentStore.collection('reports').insert({ name: response.meta.reportName }, request).then((r) => r._id)
      } else {
        report._id = response.meta.reportsOptions._id
      }

      const reportBlobName = reportsOptions.blobName ? reportsOptions.blobName : report._id

      report.blobName = await reporter.blobStorage.write(`${reportBlobName}.${report.fileExtension}`, response.content, request, response)

      await reporter.documentStore.collection('reports').update({
        _id: report._id
      }, {
        $set: {
          ..._omit(report, '_id'),
          state: 'success'
        }
      }, request)

      response.meta.reportId = report._id
      response.meta.reportBlobName = report.blobName

      if (request.context.http) {
        response.meta.headers['Permanent-Link'] = `${request.context.http.baseUrl}/reports/${reportsOptions.public === true ? 'public/' : ''}${report._id}/content`
        response.meta.headers['Report-Id'] = response.meta.reportId
        response.meta.headers['Report-BlobName'] = response.meta.reportBlobName
      }

      reporter.logger.debug('Report stored as ' + report.blobName, request)
    })
  })
}
