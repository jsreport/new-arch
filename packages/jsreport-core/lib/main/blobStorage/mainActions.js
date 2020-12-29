module.exports = (reporter) => {
  reporter.registerMainAction('blobStorage.read', async (spec, originalReq) => {
    const localReq = reporter.Request(originalReq)
    const res = await reporter.blobStorage.read(spec.blobName, localReq)

    const chunks = []
    for await (const chunk of res) {
      chunks.push(chunk)
    }
    return Buffer.concat(chunks).toString('base64')
  })

  reporter.registerMainAction('blobStorage.write', async (spec, originalReq) => {
    const localReq = reporter.Request(originalReq)

    const res = await reporter.blobStorage.write(spec.blobName, Buffer.from(spec.content, 'base64'), localReq)
    return res
  })

  reporter.registerMainAction('blobStorage.remove', async (spec, originalReq) => {
    const localReq = reporter.Request(originalReq)
    const res = await reporter.blobStorage.remove(spec.blobName, localReq)
    return res
  })
}
