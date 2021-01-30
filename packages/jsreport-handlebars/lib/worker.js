const path = require('path')
const createEngine = require('./handlebarsEngine')

module.exports = (reporter, definition) => {
  const hbRawPath = definition.options.handlebarsModulePath != null ? definition.options.handlebarsModulePath : require.resolve('handlebars')
  const hbPath = path.join(path.dirname(hbRawPath), '../')

  if (reporter.options.templatingEngines.allowedModules !== '*') {
    reporter.options.templatingEngines.allowedModules.push(hbPath)
    reporter.options.templatingEngines.allowedModules.push('handlebars')
  }

  const { compile, execute, onGetContext, onRequire } = createEngine({
    handlebarsModulePath: hbPath
  })

  reporter.extensionsManager.engines.push({
    name: 'handlebars',
    compile,
    execute,
    onGetContext,
    onRequire
  })
}
