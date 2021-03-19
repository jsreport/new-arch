module.exports = (reporter, options) => {
  let provider

  return {
    async read (blobName, req) {
      const r = await provider.read(blobName, req)
      if (r == null) {
        throw reporter.createError(`Blob ${blobName} wasn't found`, {
          statusCode: 404
        })
      }
      return r
    },

    write (blobName, buffer, req) {
      return provider.write(blobName, buffer, req)
    },

    async remove (blobName, req) {
      return provider.remove(blobName)
    },

    async init () {
      if (provider.init) {
        return provider.init()
      }
    },

    drop () {
      if (provider.drop) {
        return provider.drop()
      }
    },

    registerProvider (p) {
      provider = p
    }
  }
}
