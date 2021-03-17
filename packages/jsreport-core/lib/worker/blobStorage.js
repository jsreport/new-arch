const { Readable } = require('stream')

module.exports = (executeMainAction) => {
  return {
    async read (blobName, req) {
      const r = await executeMainAction('blobStorage.read', {
        blobName
      }, req)
      return Readable.from(Buffer.from(r, 'base64'))
    },

    async readBuffer (blobName, req) {
      return Buffer.from(await executeMainAction('blobStorage.read', {
        blobName
      }, req), 'base64')
    },

    write (blobName, content, req) {
      return executeMainAction('blobStorage.write', {
        blobName,
        content: Buffer.from(content).toString('base64')
      }, req)
    },

    remove (blobName, req) {
      return executeMainAction('blobStorage.remove', {
        blobName
      }, req)
    },

    init () {

    }
  }
}
