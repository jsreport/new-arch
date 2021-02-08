/*!
 * Copyright(c) 2018 Jan Blaha
 *
 * Extension allowing to add custom javascript hooks into the rendering process.
 */
const executeScript = require('./executeScript')

module.exports = function (reporter, definition) {
  reporter.addRequestContextMetaConfig('scriptsCache', { sandboxHidden: true })

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

  async handleBeforeRender (req, res) {
    req.context.scriptsCache = await this._findScripts(req)

    for (const script of req.context.scriptsCache) {
      await this._runScript(req, res, script, 'beforeRender')
    }
  }

  async handleAfterRender (req, res) {
    for (const script of req.context.scriptsCache) {
      if (script.shouldRunAfteRender) {
        await this._runScript(req, res, script, 'afterRender')
      }
    }
  }

  async _runScript (req, res, script, method) {
    this.reporter.logger.debug(`Executing script ${(script.name || script.shortid || 'anonymous')} (${method})`, req)

    await this.reporter.beforeScriptListeners.fire({ script: script.content }, req)

    const scriptExecResult = await executeScript(this.reporter, script, method, req, res)

    if (scriptExecResult.shouldRunAfterRender) {
      script.shouldRunAfteRender = true
    }

    if (scriptExecResult.requestCancel) {
      const error = this.reporter.createError(`Rendering req canceled from the script${
        scriptExecResult.additionalInfo != null ? `: ${scriptExecResult.additionalInfo}` : ''
      }`, {
        weak: true
      })

      if (scriptExecResult.statusCode) {
        error.statusCode = scriptExecResult.statusCode
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
      req.data = scriptExecResult.req.data
      delete scriptExecResult.req.data
      merge(req, scriptExecResult.req)
    }

    if (method === 'afterRender') {
      res.content = Buffer.from(scriptExecResult.res.content)
      delete scriptExecResult.res.content
      merge(res, scriptExecResult.res)

      delete scriptExecResult.req.data
      merge(req, scriptExecResult.req)
    }

    return res
  }

  async _findScripts (req) {
    req.template.scripts = req.template.scripts || []

    const items = await Promise.all(req.template.scripts.map(async (script) => {
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

      const items = await this.reporter.documentStore.collection('scripts').find(query, req)
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

    const globalItems = await this.reporter.documentStore.collection('scripts').find({ isGlobal: true }, req)
    return globalItems.concat(items)
  }
}
