
/* TODO: consider this small logic for the jsreport-proxy api
async function render (reporter, originalReq, spec) {
  const res = await reporter.render({
    ...spec.req,
    // new fresh context (user data and cycle control counter is inherit from orginalReq during rendering).
    // this avoids that user can fake user identity by sending context
    // with information of another user and allows the original request to collect logs
    // from the render of proxy
    context: {}
  }, originalReq)

  return {
    content: res.content,
    meta: res.meta
  }
}
*/

async function documentStoreFind (reporter, originalReq, spec) {
  const localReq = reporter.Request(originalReq)
  localReq.context.userFindCall = true
  const res = await reporter.documentStore.collection(spec.collection).find(spec.query, localReq)
  return res
}

async function documentStoreFindOne (reporter, originalReq, spec) {
  const localReq = reporter.Request(originalReq)
  localReq.context.userFindCall = true
  const res = await reporter.documentStore.collection(spec.collection).findOne(spec.query, localReq)
  return res
}

module.exports = (reporter) => (data, req) => {
  switch (data.action) {
    case 'documentStore.collection.find': return documentStoreFind(reporter, req, data.data)
    case 'documentStore.collection.findOne': return documentStoreFindOne(reporter, req, data.data)
  }
}
