module.exports = ({ model, collections }, executeMainAction) => {
  const store = {
    model,
    collection: (name) => ({
      find: (q, req) => executeMainAction('documentStore.collection.find', {
        query: q,
        collection: name
      }, req),
      findOne: (q, req) => executeMainAction('documentStore.collection.findOne', {
        query: q,
        collection: name
      }, req),
      insert: (doc, req) => executeMainAction('documentStore.collection.insert', {
        doc,
        collection: name
      }, req),
      update: async (query, update, options, req) => {
        if (req == null) {
          req = options
          options = {}
        }
        const r = await executeMainAction('documentStore.collection.update', {
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

  for (const colName of collections) {
    store.collections[colName] = {
      name: colName,
      ...store.collection(colName)
    }
  }

  return store
}
