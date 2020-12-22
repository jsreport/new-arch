module.exports = (reporter) => {
  reporter.registerMainAction('documentStore.collection.find', async (spec, originalReq) => {
    const localReq = reporter.Request(originalReq)
    localReq.context.userFindCall = true
    const res = await reporter.documentStore.collection(spec.collection).find(spec.query, localReq)
    return res
  })

  reporter.registerMainAction('documentStore.collection.findOne', async (spec, originalReq) => {
    const localReq = reporter.Request(originalReq)
    localReq.context.userFindCall = true
    const res = await reporter.documentStore.collection(spec.collection).findOne(spec.query, localReq)
    return res
  })
}
