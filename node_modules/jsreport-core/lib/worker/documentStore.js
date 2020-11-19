const { getCallback } = require('./registryUtils')

module.exports = (registry, documentStoreData) => {
  const store = {
    model: documentStoreData.model,
    collection: (name) => ({
      find: (q, req) => getCallback(registry, req)({
        action: 'documentStore.collection.find',
        requestRootId: req.context.rootId,
        data: {
          query: q,
          collection: name
        }
      }),
      findOne: (q, req) => getCallback(registry, req)({
        action: 'documentStore.collection.findOne',
        requestRootId: req.context.rootId,
        data: {
          query: q,
          collection: name
        }
      })
    })
  }

  store.collections = {}

  for (const colName of documentStoreData.collections) {
    store.collections[colName] = {
      name: colName,
      ...store.collection(colName)
    }
  }

  return store
}
