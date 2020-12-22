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
      }, req)
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
