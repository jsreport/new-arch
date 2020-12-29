/*!
 * Copyright(c) 2018 Jan Blaha
 *
 * Reports extension allows to store rendering output into storage for later use.
 */

const url = require('url')
const parseDuration = require('parse-duration')

class Reports {
  constructor (reporter, definition) {
    this.reporter = reporter
    this.definition = definition

    this.reporter.on('express-configure', this.configureExpress.bind(this))

    this._defineEntities()

    this.reporter.initializeListeners.add(definition.name, () => {
      if (this.reporter.authentication) {
        this.reporter.emit('export-public-route', '/reports/public')
      }

      if (this.reporter.authorization) {
        this.reporter.authorization.findPermissionFilteringListeners.add(definition.name, this._reportsFiltering.bind(this))
      }

      const col = reporter.documentStore.collection('reports')

      // this listener should run after the authorization check, so it is safe to remove
      // the blob attacthed to the report. ideally we should execute this remove in an "afterRemove"
      // event but since that does not exists we have to make sure that the listener executes after
      // the authorization check
      col.beforeRemoveListeners.add({ after: 'authorization-cascade-remove' }, definition.name, async (query) => {
        const result = await col.find({ _id: query._id })

        if (result.length === 0) {
          throw reporter.createError(`Report ${query._id} not found`, {
            statusCode: 404
          })
        }

        if (!result[0].blobName) {
          return
        }

        if (typeof reporter.blobStorage.remove !== 'function') {
          reporter.logger.debug('Skipping removing ' + result[0].blobName + ' from storage because configured blobStorage doesn\'t support remove functionality')
          return
        }

        await reporter.blobStorage.remove(result[0].blobName)
        reporter.logger.debug('Report ' + result[0].blobName + ' was removed from storage')
      })
    })

    if (definition.options.cleanInterval && definition.options.cleanTreshold) {
      this.reporter.logger.info(`reports extension has enabled old reports cleanup with interval ${definition.options.cleanInterval} and treshold ${definition.options.cleanTreshold}`)
      this.cleanTresholdMS = parseDuration(definition.options.cleanTreshold + '')
      this.cleanIntervalMS = parseDuration(definition.options.cleanInterval + '')

      this.cleanInterval = setInterval(() => this.clean(), this.cleanIntervalMS)
      this.cleanInterval.unref()
      this.reporter.closeListeners.add('reports', () => clearInterval(this.cleanInterval))
    }
  }

  configureExpress (app) {
    const serveReport = async (req, res) => {
      const result = await this.reporter.documentStore.collection('reports').find({ _id: req.params.id }, req)

      if (result.length !== 1) {
        throw this.reporter.createError(`Report ${req.params.id} not found`, {
          statusCode: 404
        })
      }

      let state = result[0].state

      if (state == null && result[0].blobName) {
        state = 'success'
      } else if (state == null) {
        state = 'error'
      }

      if (state !== 'success') {
        let errMsg = `Report ${req.params.id} content not found`

        if (req.context.http) {
          errMsg = `${errMsg}, check ${req.context.http.baseUrl}/reports/${result[0]._id}/status for details`
        }

        throw this.reporter.createError(errMsg, {
          statusCode: 404
        })
      }

      const stream = await this.reporter.blobStorage.read(result[0].blobName)

      stream.on('error', function (err) {
        res.error(err)
      })

      if (result[0].contentType) {
        res.setHeader('Content-Type', result[0].contentType)
      }
      if (result[0].fileExtension) {
        res.setHeader('File-Extension', result[0].fileExtension)
      }

      return { stream: stream, report: result[0] }
    }

    app.get('/reports/public/:id/content', async (req, res, next) => {
      const reportId = req.params.id

      try {
        const result = await this.reporter.documentStore.collection('reports').find({ _id: reportId }, req)

        if (result.length !== 1 || !result[0].public) {
          throw this.reporter.createError(`Report ${req.params.id} not found`, {
            statusCode: 404
          })
        }

        const reportResult = await serveReport(req, res)
        reportResult.stream.pipe(res)
      } catch (e) {
        next(e)
      }
    })

    app.get('/reports/:id/content', (req, res, next) => {
      serveReport(req, res).then((result) => result.stream.pipe(res)).catch(next)
    })

    app.get('/reports/:id/attachment', (req, res, next) => {
      serveReport(req, res).then((result) => {
        res.setHeader('Content-Disposition', `attachment; filename="${result.report.name}.${result.report.fileExtension}"`)
        result.stream.pipe(res)
      }).catch(next)
    })

    app.get('/reports/:id/status', (req, res, next) => {
      this.reporter.documentStore.collection('reports').find({ _id: req.params.id }, req).then((result) => {
        if (result.length !== 1) {
          throw this.reporter.createError(`Report ${req.params.id} not found`, {
            statusCode: 404
          })
        }

        let state = result[0].state

        if (state == null && result[0].blobName) {
          state = 'success'
        } else if (state == null) {
          state = 'error'
        }

        if (state === 'planned') {
          res.setHeader('Report-State', state)
          res.send('Report is pending. Wait until 201 response status code')
        } else if (state === 'error') {
          res.setHeader('Report-State', state)
          res.send(`Report generation failed.${' ' + (result[0].error || '')}`)
        } else {
          let link = req.protocol + '://' + req.headers.host
          const pathnameParts = url.parse(req.originalUrl).pathname.split('/')

          pathnameParts[pathnameParts.length - 1] = 'content'

          if (result[0].public === true) {
            pathnameParts.splice(pathnameParts.length - 2, 0, 'public')
          }

          link += pathnameParts.join('/')

          res.setHeader('Report-State', state)
          res.setHeader('Location', link)
          res.setHeader('Content-Type', 'text/html')
          res.status(201).send("Report is ready, check Location header or download it <a href='" + link + "'>here</a>")
        }
      }).catch(next)
    })
  }

  async clean () {
    try {
      this.reporter.logger.debug('Cleaning up old reports')
      const removeOlderDate = new Date(Date.now() - this.cleanTresholdMS)
      const reportsToRemove = await this.reporter.documentStore.collection('reports').find({ creationDate: { $lt: removeOlderDate } })
      this.reporter.logger.debug(`Cleaning old reports with remove ${reportsToRemove.length} reports`)
      await Promise.all(reportsToRemove.map((r) => this.reporter.documentStore.collection('reports').remove({ _id: r._id })))
    } catch (e) {
      this.reporter.logger.error('Failed to clean up old reports', e)
    }
  }

  _defineEntities () {
    this.ReportType = this.reporter.documentStore.registerEntityType('ReportType', {
      recipe: { type: 'Edm.String' },
      blobName: { type: 'Edm.String' },
      contentType: { type: 'Edm.String' },
      name: { type: 'Edm.String' },
      fileExtension: { type: 'Edm.String' },
      public: { type: 'Edm.Boolean' },
      templateShortid: { type: 'Edm.String', referenceTo: 'templates' },
      state: { type: 'Edm.String' },
      error: { type: 'Edm.String' }
    })

    this.reporter.documentStore.registerEntitySet('reports', {
      entityType: 'jsreport.ReportType',
      exportable: false
    })
  }

  async _reportsFiltering (collection, query, req) {
    if (collection.name === 'reports') {
      if (query.templateShortid) {
        const templates = await this.reporter.documentStore.collection('templates').find({ shortid: query.templateShortid })
        if (templates.length !== 1) {
          return
        }

        delete query.readPermissions
      }

      const templates = await this.reporter.documentStore.collection('templates').find({}, req)
      delete query.readPermissions
      query.$or = [{
        templateShortid: {
          $in: templates.map(function (t) {
            return t.shortid
          })
        }
      }, { readPermissions: req.context.user._id.toString() }]
    }
  }
}

module.exports = function (reporter, definition) {
  reporter[definition.name] = new Reports(reporter, definition)
}