const Transaction = require('./transaction')
const Persistence = require('./persistence')
const { uid } = require('./customUtils')
const mingo = require('@jsreport/mingo')
const Promise = require('bluebird')
const documentModel = require('./documentModel')
const Queue = require('./queue')
const omit = require('lodash.omit')
const FileSystemPersistence = require('./fileSystem')
const ExternalModificationsSync = require('./externalModificationsSync')
const rimrafAsync = Promise.promisify(require('rimraf'))
const EventEmitter = require('events').EventEmitter
const extend = require('node.extend.without.arrays')
const Journal = require('./journal')

module.exports = ({
  dataDirectory,
  blobStorageDirectory,
  logger,
  externalModificationsSync,
  persistence = {},
  corruptAlertThreshold,
  compactionEnabled,
  compactionInterval,
  persistenceQueueWaitingTimeout,
  resolveFileExtension,
  createError
}) => {
  return {
    name: 'fs',
    persistenceHandlers: {
      fs: FileSystemPersistence
    },
    emitter: new EventEmitter(),
    createError,
    on (...args) {
      this.emitter.on(...args)
    },
    emit (...args) {
      this.emitter.emit(...args)
    },
    get dataDirectory () {
      return dataDirectory
    },
    async load (model) {
      this.documentsModel = documentModel(model)

      const PersistenceProvider = this.persistenceHandlers[persistence.provider]
      if (!PersistenceProvider) {
        throw new Error(`File system store persistence provider ${persistence.provider} was not registered`)
      }
      logger.info(`fs store is persisting using ${persistence.provider} for ${dataDirectory}`)
      this.fs = PersistenceProvider(Object.assign({ dataDirectory: dataDirectory }, persistence))

      this.persistence = Persistence({
        documentsModel: this.documentsModel,
        fs: this.fs,
        corruptAlertThreshold,
        resolveFileExtension
      })

      this.queue = Queue(persistenceQueueWaitingTimeout)
      this.transaction = Transaction({ queue: this.queue, persistence: this.persistence, fs: this.fs, logger })

      this.journal = Journal({
        fs: this.fs,
        transaction: this.transaction,
        reload: this.reload.bind(this),
        logger,
        queue: this.queue
      })

      if (externalModificationsSync) {
        this.externalModificationsSync = ExternalModificationsSync({
          dataDirectory,
          fs: this.fs,
          blobStorageDirectory,
          transaction: this.transaction,
          logger,
          onModification: (e) => {
            this.emit('external-modification', e)
            return this.reload()
          }
        })
      }

      await this.fs.init()

      await this.transaction.init()

      await this.reload()

      await this.journal.init()

      if (externalModificationsSync) {
        await this.externalModificationsSync.init()
      }

      if (compactionEnabled) {
        await this._startCompactionInterval()
      }

      logger.info('fs store is initialized successfully')
    },

    async reload () {
      logger.info('fs store is loading data')

      return this.transaction.operation(async (documents) => {
        const _documents = await this.persistence.load()
        Object.keys(documents).forEach(k => delete documents[k])
        Object.keys(this.documentsModel.entitySets).forEach(e => (documents[e] = []))
        _documents.forEach(d => documents[d.$entitySet].push(d))
      })
    },

    beginTransaction () {
      return this.transaction.begin()
    },

    async commitTransaction (tran) {
      await this.transaction.commit(tran)
      return this.journal.commit()
    },

    sync () {
      return this.journal.sync()
    },

    async rollbackTransaction (tran) {
      return this.transaction.rollback(tran)
    },

    find (entitySet, query, fields, opts = {}) {
      const documents = this.transaction.getCurrentDocuments(opts)
      const cursor = mingo.find(documents[entitySet], query, fields)
      // the queue is not used here because reads are supposed to not block
      cursor.toArray = () => cursor.all().map((v) => extend(true, {}, omit(v, '$$etag', '$entitySet')))
      return cursor
    },

    insert (entitySet, doc, opts = {}) {
      return this.transaction.operation(opts, async (documents, persistence, rootDirectoy) => {
        doc._id = doc._id || uid(16)
        doc.$entitySet = entitySet

        await persistence.insert(doc, documents, rootDirectoy)

        const clone = extend(true, {}, doc)
        clone.$$etag = Date.now()

        documents[entitySet].push(clone)

        if (opts.transaction) {
          return doc
        }

        await this.journal.insert(clone, opts)
        return doc
      })
    },

    async update (entitySet, q, u, opts = {}) {
      let count

      const res = await this.transaction.operation(opts, async (documents, persistence, rootDirectoy) => {
        const toUpdate = mingo.find(documents[entitySet], q).all()

        count = toUpdate.length

        // need to get of queue first before calling insert, otherwise we get a deathlock
        if (toUpdate.length === 0 && opts.upsert) {
          return 'insert'
        }

        for (const doc of toUpdate) {
          await persistence.update(extend(true, {}, omit(doc, '$$etag'), u.$set || {}), doc, documents, rootDirectoy)

          Object.assign(doc, u.$set || {})

          doc.$$etag = Date.now()

          if (opts.transaction) {
            return
          }

          await this.journal.update(doc, opts)
        }
      })

      if (res === 'insert') {
        await this.insert(entitySet, u.$set, opts)
        return 1
      }

      return count
    },

    async remove (entitySet, q, opts = {}) {
      return this.transaction.operation(opts, async (documents, persistence, rootDirectoy) => {
        const toRemove = mingo.find(documents[entitySet], q).all()

        for (const doc of toRemove) {
          await persistence.remove(doc, documents, rootDirectoy)
        }

        documents[entitySet] = documents[entitySet].filter(d => !toRemove.includes(d))

        if (opts.transaction) {
          return
        }

        for (const doc of toRemove) {
          await this.journal.remove(doc, opts)
        }
      })
    },

    registerPersistence (name, persistence) {
      this.persistenceHandlers[name] = persistence
    },

    async close () {
      if (externalModificationsSync) {
        await this.externalModificationsSync.close()
      }

      if (this.autoCompactionInterval) {
        clearInterval(this.autoCompactionInterval)
      }

      this.transaction.close()
      this.journal.close()
    },

    drop () {
      this.close()
      return rimrafAsync(dataDirectory)
    },

    async _startCompactionInterval () {
      let compactIsQueued = false
      const compact = () => {
        if (compactIsQueued) {
          return
        }
        compactIsQueued = true
        return Promise.resolve(this.transaction.operation((documents) => this.persistence.compact(documents)))
          .catch((e) => logger.warn('fs store compaction failed, but no problem, it will retry the next time.' + e.message))
          .finally(() => (compactIsQueued = false))
      }
      this.autoCompactionInterval = setInterval(compact, compactionInterval).unref()
      // make sure we cleanup also when process just renders and exit
      // like when using jsreport.exe render
      await compact()
    }
  }
}
