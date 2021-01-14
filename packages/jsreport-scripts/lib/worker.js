/*!
 * Copyright(c) 2018 Jan Blaha
 *
 * Extension allowing to add custom javascript hooks into the rendering process.
 */
const executeScript = require('./executeScript')

module.exports = function (reporter, definition) {
  reporter.addRequestContextMetaConfig('_parsedScripts', { sandboxHidden: true })
  reporter.addRequestContextMetaConfig('shouldRunAfterRender', { sandboxHidden: true })

  reporter.scripts = new Scripts(reporter, definition)
}

class Scripts {
  constructor (reporter, definition) {
    this.reporter = reporter
    this.definition = definition

    reporter.beforeScriptListeners = reporter.createListenerCollection()

    reporter.beforeRenderListeners.insert({
      after: 'data',
      before: 'childTemplates'
    }, definition.name, reporter, this.handleBeforeRender.bind(this))

    reporter.afterRenderListeners.add(definition.name, reporter, this.handleAfterRender.bind(this))
  }

  async handleBeforeRender (request, response) {
    request.context._parsedScripts = []
    const scripts = await this._findScripts(request)

    for (const script of scripts) {
      await this._runScript(request, response, script, 'beforeRender')
    }
  }

  async handleAfterRender (request, response) {
    for (const script of request.context._parsedScripts) {
      await this._runScript(request, response, script, 'afterRender')
    }
  }

  async _runScript (request, response, script, method) {
    this.reporter.logger.debug(`Executing script ${(script.name || script.shortid || 'anonymous')} (${method})`, request)

    const parsedScript = typeof script !== 'string' ? {
      name: script.name,
      shortid: script.shortid,
      content: script.content
    } : script

    const scriptContent = typeof script === 'string' ? script : script.content

    const scriptDef = {
      script: scriptContent,
      requestContextMetaConfig: this.reporter.getRequestContextMetaConfig(),
      allowedModules: this.definition.options.allowedModules,
      safeSandboxPath: this.reporter.options.templatingEngines.safeSandboxPath,
      appDirectory: this.reporter.options.appDirectory,
      rootDirectory: this.reporter.options.rootDirectory,
      parentModuleDirectory: this.reporter.options.parentModuleDirectory,
      method: method,
      request,
      response
    }

    await this.reporter.beforeScriptListeners.fire(scriptDef, request)

    const body = await executeScript(this.reporter, scriptDef, request, (log) => {
      this.reporter.logger[log.level](log.message, { ...request, timestamp: log.timestamp })
    })

    if (body.request && body.request.context.shouldRunAfterRender && method === 'beforeRender') {
      request.context._parsedScripts.push(parsedScript)
    }

    if (body.error) {
      const error = this.reporter.createError(body.error.message, {
        weak: true
      })

      error.stack = body.error.stack
      throw error
    }

    if (body.cancelRequest) {
      const error = this.reporter.createError(`Rendering request canceled from the script${
        body.additionalInfo != null ? `: ${body.additionalInfo}` : ''
      }`, {
        weak: true
      })

      if (body.statusCode) {
        error.statusCode = body.statusCode
      }

      error.canceled = true
      throw error
    }

    function merge (obj, obj2) {
      for (const key in obj2) {
        if (typeof obj2[key] === 'undefined') {
          continue
        }

        if (typeof obj2[key] !== 'object' || typeof obj[key] === 'undefined') {
          obj[key] = obj2[key]
        } else {
          merge(obj[key], obj2[key])
        }
      }
    }

    if (method === 'beforeRender') {
      request.data = body.request.data
      delete body.request.data
      merge(request, body.request)
    }

    if (method === 'afterRender') {
      response.content = Buffer.from(body.response.content)
      delete body.response.content
      merge(response, body.response)

      delete body.request.data
      merge(request, body.request)
    }

    return response
  }

  async _findScripts (request) {
    request.template.scripts = request.template.scripts || []

    const items = await Promise.all(request.template.scripts.map(async (script) => {
      if (script.content) {
        return script
      }

      const query = {}
      if (script.shortid) {
        query.shortid = script.shortid
      }

      if (script.name) {
        query.name = script.name
      }

      const items = await this.reporter.documentStore.collection('scripts').find(query, request)
      if (items.length < 1) {
        const error = this.reporter.createError(`Script not found or user not authorized to read it (${
          (script.shortid || script.name)
        })`, {
          weak: true,
          statusCode: 403
        })

        throw error
      }
      return items[0]
    }))

    const globalItems = await this.reporter.documentStore.collection('scripts').find({ isGlobal: true }, request)
    return globalItems.concat(items)
  }
}
