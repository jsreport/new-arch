const { pipeline } = require('stream')
const omit = require('lodash.omit')
const serveStatic = require('serve-static')
const handleError = require('./handleError')
const FormData = require('./formDataStream')
const odata = require('./odata')
const oneMonth = 31 * 86400000

module.exports = (app, reporter, exposedOptions) => {
  reporter.emit('export-public-route', '/api/ping')

  const handleErrorMiddleware = handleError(reporter)

  app.use((req, res, next) => {
    res.error = (err) => handleErrorMiddleware(req, res, err)
    next()
  })

  reporter.emit('after-express-static-configure', app)
  reporter.emit('express-before-odata', app)

  const odataServer = odata(reporter)
  app.use('/odata', (req, res) => odataServer.handle(req, res))

  reporter.extensionsManager.extensions.forEach((e) => app.use('/extension/' + e.name, serveStatic(e.directory, { maxAge: oneMonth })))

  function httpRender (renderRequest, req, res, stream, next) {
    let renderTimeout = (reporter.options.express || {}).renderTimeout

    if (renderTimeout == null) {
      renderTimeout = 20 * 60 * 1000
    }

    res.setTimeout(renderTimeout)
    res.setHeader('X-XSS-Protection', 0)

    renderRequest = Object.assign({}, renderRequest, {
      options: renderRequest.options || {},
      context: Object.assign({}, renderRequest.context, req.context)
    })

    let form
    let profiler
    if (stream) {
      form = new FormData()
      res.setHeader('Content-Type', `multipart/mixed; boundary=${form.getBoundary()}`)

      profiler = reporter.attachProfiler(renderRequest)

      profiler.on('profile', (m) => {
        form.append(m.type, JSON.stringify(m), { contentType: 'application/json' })
      })

      pipeline(form, res, (err) => {
        if (err) {
          res.destroy()
        }
      })
    }

    reporter.render(renderRequest).then((renderResponse) => {
      const headers = {}

      headers['Content-Type'] = renderResponse.meta.contentType

      let reportName = renderResponse.meta.reportName
      reportName = isInvalidASCII(reportName) ? 'report' : reportName

      headers['Content-Disposition'] = `inline;filename=${reportName}.${renderResponse.meta.fileExtension}`

      if (renderRequest.options['Content-Disposition']) {
        headers['Content-Disposition'] = renderRequest.options['Content-Disposition']
      }

      if (renderRequest.options.download) {
        headers['Content-Disposition'] = headers['Content-Disposition'].replace('inline;', 'attachment;')
      }

      if (stream) {
        form.append('report', renderResponse.stream, {
          filename: `${reportName}.${renderResponse.meta.fileExtension}`,
          contentLength: renderResponse.content.length,
          header: headers
        })

        form.end()
      } else {
        for (const [key, value] of Object.entries(headers)) {
          res.setHeader(key, value)
        }

        if (renderResponse.meta.headers) {
          for (const key in renderResponse.meta.headers) {
            res.setHeader(key, renderResponse.meta.headers[key])
          }
        }

        pipeline(renderResponse.stream, res, (pipeErr) => {
          if (pipeErr) {
            return next(pipeErr)
          }

          next()
        })
      }
    }).catch((renderErr) => {
      if (!stream) {
        next(renderErr)
      } else {
        form.end()
      }
    })
  }

  reporter.express.streamRender = (renderRequest, req, res, next) => {
    return httpRender(renderRequest, req, res, true, next)
  }

  reporter.express.render = (renderRequest, req, res, next) => {
    return httpRender(renderRequest, req, res, false, next)
  }

  /**
   * Main entry point for invoking report rendering
   */
  app.post('/api/report/:name?', (req, res, next) => {
    if (!req.body.template) {
      return next("Could not parse report template, aren't you missing content type?")
    }

    let doRender

    if (req.query.profilerDebug === 'true') {
      doRender = reporter.express.streamRender
    } else {
      doRender = reporter.express.render
    }

    doRender({
      template: req.body.template,
      data: req.body.data,
      options: req.body.options
    }, req, res, next)
  })

  app.get('/api/version', (req, res, next) => res.send(reporter.version))

  app.get('/api/settings', (req, res, next) => res.send({
    tenant: omit(req.user, 'password')
  }))

  app.get('/api/recipe', (req, res, next) => res.json(reporter.extensionsManager.recipes.map((r) => r.name)))

  app.get('/api/engine', (req, res, next) => res.json(reporter.extensionsManager.engines.map((r) => r.name)))

  app.get('/api/extensions', (req, res, next) => {
    const extensions = reporter.extensionsManager.extensions.map((extension) => {
      let publicOptions = {}

      if (exposedOptions[extension.name] != null) {
        publicOptions = exposedOptions[extension.name]
      }

      return {
        name: extension.name,
        main: extension.main,
        source: extension.source,
        version: extension.version,
        dependencies: extension.dependencies,
        options: publicOptions
      }
    })

    res.json(extensions)
  })

  app.get('/api/ping', (req, res, next) => {
    if (!reporter._initialized) {
      return res.status(403).send('Not yet initialized.')
    }
    res.send('pong')
  })

  app.get('/api/profile/:id/content', async (req, res, next) => {
    try {
      const profile = await reporter.documentStore.collection('profiles').findOne({ _id: req.params.id }, req)
      if (!profile) {
        throw this.reporter.createError(`Profile ${req.params.id} not found`, {
          statusCode: 404
        })
      }

      const stream = await reporter.blobStorage.read(profile.blobName)
      stream.pipe(res)
    } catch (e) {
      next(e)
    }
  })
}

function isInvalidASCII (str) {
  return [...str].some(char => char.charCodeAt(0) > 127)
}
