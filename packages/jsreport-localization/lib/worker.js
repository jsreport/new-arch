const fs = require('fs').promises
const path = require('path')

module.exports = async (reporter, definition) => {
  let helpers
  reporter.initializeListeners.add('assets', async () => {
    helpers = (await fs.readFile(path.join(__dirname, '../static/helpers.js'))).toString()
  })

  reporter.beforeRenderListeners.add(definition.name, this, (req, res) => {
    req.template.helpers += '\n' + helpers
  })

  reporter.extendProxy((proxy, req) => {
    proxy.localization = {
      localize: async function (key, folder) {
        if (key == null) {
          throw new Error('localize expects key paramenter')
        }

        folder = folder != null ? folder : 'localization'
        const language = req.options.localization ? req.options.localization.language : req.options.language
        const localizationDataPath = `${folder}/${language || 'en'}.json`
        const resolvedValue = await proxy.folders.resolveEntityFromPath(localizationDataPath, 'assets')

        if (!resolvedValue) {
          throw new Error('localize helper couldn\'t find asset with data at ' + localizationDataPath)
        }

        const localizedData = JSON.parse(resolvedValue.entity.content.toString())
        return localizedData[key]
      }
    }
  })
}
