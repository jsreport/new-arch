
const path = require('path')
const createEngine = require('./handlebarsEngine')

module.exports = (reporter, definition) => {
  const hbRawPath = definition.options.handlebarsModulePath != null ? definition.options.handlebarsModulePath : require.resolve('handlebars')
  const hbPath = path.join(path.dirname(hbRawPath), '../')

  reporter.options.templatingEngines.nativeModules.push({
    globalVariableName: 'handlebars',
    module: hbPath
  })

  // alias Handlebars=handlebars
  reporter.options.templatingEngines.nativeModules.push({
    globalVariableName: 'Handlebars',
    module: hbPath
  })

  reporter.options.templatingEngines.modules.push({
    alias: 'handlebars',
    path: hbPath
  })

  const { compile, execute } = createEngine({
    handlebarsModulePath: hbPath
  })

  reporter.extensionsManager.engines.push({
    name: 'handlebars',
    compile,
    execute
  })
}
