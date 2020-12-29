module.exports = (documentStoreData, executeActionInMain) => {
  const store = {
    model: documentStoreData.model,
    collection: (name) => ({
      find: (q, req) => executeActionInMain('documentStore.collection.find', {
        query: q,
        collection: name
      }, req),
      findOne: (q, req) => executeActionInMain('documentStore.collection.findOne', {
        query: q,
        collection: name
      }, req),
      insert: (doc, req) => executeActionInMain('documentStore.collection.insert', {
        doc,
        collection: name
      }, req),
      update: async (query, update, options, req) => {
        if (req == null) {
          req = options
          options = {}
        }
        const r = await executeActionInMain('documentStore.collection.update', {
          query,
          update,
          options,
          collection: name
        }, req)
        return r
      }
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
