const path = require('path')

module.exports = (reporter, extensionsDefs) => {
  return {
    recipes: [],
    engines: [],
    extensions: extensionsDefs,

    async init () {
      for (const extension of this.extensions) {
        await require(path.join(extension.directory, extension.worker))(reporter, extension)
      }
    }
  }
}
