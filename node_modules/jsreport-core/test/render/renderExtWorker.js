const vm = require('vm')

module.exports = (reporter, definition) => {
  reporter.beforeRenderListeners.add('render-testing', async (req, res) => {
    if (req.context.skipRenderExt) {
      return
    }

    const functions = parseFunctions(req.template.content)

    if (functions.beforeRender) {
      await functions.beforeRender(req, res, reporter)
    }
  })

  reporter.validateRenderListeners.add('render-testing', async (req, res) => {
    if (req.context.skipRenderExt) {
      return
    }

    const functions = parseFunctions(req.template.content)

    if (functions.validateRender) {
      await functions.validateRender(req, res, reporter)
    }
  })

  reporter.afterTemplatingEnginesExecutedListeners.add('render-testing', async (req, res) => {
    if (req.context.skipRenderExt) {
      return
    }

    const functions = parseFunctions(req.template.content)

    if (functions.afterTemplatingEnginesExecuted) {
      await functions.afterTemplatingEnginesExecuted(req, res, reporter)
    }
  })

  reporter.afterRenderListeners.add('render-testing', async (req, res) => {
    if (req.context.skipRenderExt) {
      return
    }

    const functions = parseFunctions(req.template.content)

    if (functions.afterRender) {
      await functions.afterRender(req, res, reporter)
    }
  })
}

function parseFunctions (functions) {
  const parsed = JSON.parse(functions)

  if (parsed.beforeRender != null) {
    parsed.beforeRender = parseFunction(parsed.beforeRender)
  }

  if (parsed.validateRender != null) {
    parsed.validateRender = parseFunction(parsed.validateRender)
  }

  if (parsed.afterTemplatingEnginesExecuted != null) {
    parsed.afterTemplatingEnginesExecuted = parseFunction(parsed.afterTemplatingEnginesExecuted)
  }

  if (parsed.afterRender != null) {
    parsed.afterRender = parseFunction(parsed.afterRender)
  }

  return parsed
}

function parseFunction (code) {
  const script = new vm.Script(`
    ;(function () {
      return ${code}
    })()
  `)

  const result = script.runInThisContext({
    displayErrors: true
  })

  return result
}
