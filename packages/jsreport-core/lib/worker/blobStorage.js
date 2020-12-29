const { Readable } = require('winston-transport')

module.exports = (executeActionInMain) => {
  return {
    async read (blobName, req) {
      const r = await executeActionInMain('blobStorage.read', {
        blobName
      }, req)
      return Readable.from(Buffer.from(r, 'base64'))
    },

    write (blobName, content, req) {
      return executeActionInMain('blobStorage.write', {
        blobName,
        content: Buffer.from(content).toString('base64')
      }, req)
    },

    remove (blobName, req) {
      return executeActionInMain('blobStorage.remove', {
        blobName
      }, req)
    },

    init () {

    }
  }
}
