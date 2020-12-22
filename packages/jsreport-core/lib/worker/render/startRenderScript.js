
module.exports = async function (reporter, inputs, logger, callback) {
  const { registry, req } = inputs

  const requestRootId = req.context.rootId

  registry.set(requestRootId, {
    callback,
    logger: logger
  })

  try {
    const res = await reporter.render(req)

    const sharedBuf = new SharedArrayBuffer(res.content.byteLength)
    const buf = Buffer.from(sharedBuf)

    res.content.copy(buf)

    return {
      meta: res.meta,
      content: buf
    }
  } finally {
    registry.delete(requestRootId)
  }
}
