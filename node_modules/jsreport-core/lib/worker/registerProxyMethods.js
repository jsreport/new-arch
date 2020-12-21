
module.exports = (reporter, proxy, defineMethod) => {
  proxy.render = defineMethod(async (context, req) => {
    const originalReq = context.request

    const res = await reporter.render({
      ...req,
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
  })

  proxy.documentStore = {
    collection: (name) => ({
      find: defineMethod(async (context, q) => {
        const originalReq = context.request
        const localReq = reporter.Request(originalReq)

        localReq.context.userFindCall = true

        const res = await reporter.documentStore.collection(name).find(q, localReq)

        return res
      }),
      findOne: defineMethod(async (context, q) => {
        const originalReq = context.request
        const localReq = reporter.Request(originalReq)

        localReq.context.userFindCall = true

        const res = await reporter.documentStore.collection(name).findOne(q, localReq)

        return res
      })
    })
  }
}
