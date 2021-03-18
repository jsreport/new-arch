module.exports = (options) => {
  let provider

  return {
    read (...args) {
      return provider.read(...args)
    },

    readBuffer (...args) {
      const stream = provider.read(...args)
      return new Promise((resolve, reject) => {
        const bufs = []
        stream.on('error', reject)
        stream.on('data', (d) => bufs.push(d))
        stream.on('end', () => {
          resolve(Buffer.concat(bufs))
        })
      })
    },

    write (...args) {
      return provider.write(...args)
    },

    async remove (...args) {
      return provider.remove(...args)
    },

    async init () {
      return provider.init()
    },

    registerProvider (p) {
      provider = p
    }
  }
}
