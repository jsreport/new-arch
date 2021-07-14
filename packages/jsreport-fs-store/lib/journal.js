const { serialize, parse, lock } = require('./customUtils')

const MAX_JOURNAL_ITEM_AGE = 60000

module.exports = ({
  fs,
  transaction,
  queue,
  reload,
  logger
}) => {
  async function loadVersion () {
    const fileExists = await fs.exists('fs.version')

    if (!fileExists) {
      return 0
    }

    const versionInFile = (await fs.readFile('fs.version')).toString()

    if (versionInFile.trim() === '') {
      return 0
    }

    return parseInt(versionInFile, 10)
  }

  // TODO THROW ERRORS when updating modified entity in the meantime
  return {
    async init () {
      const version = await lock(fs, loadVersion)

      this.lastVersion = version
      this.lastSync = new Date()
      this.cleanInterval = setInterval(() => queue.push(() => lock(fs, () => this.clean().catch((e) => logger.warn('Error when cleaning fs journal', e)))), 60000)
      this.cleanInterval.unref()

      this.waitAndSync = () => queue.push(() => lock(fs, () => this.sync(true)))

      this.syncInterval = setInterval(this.waitAndSync, 10000)
      this.syncInterval.unref()
    },

    insert (doc, opts) {
      if (opts.transaction) {
        return
      }

      return this._appendToJournal('insert', doc)
    },

    update (doc, opts) {
      if (opts.transaction) {
        return
      }

      return this._appendToJournal('update', doc)
    },

    remove (doc, opts) {
      if (opts.transaction) {
        return
      }

      return this._appendToJournal('remove', { _id: doc._id, $entitySet: doc.$entitySet })
    },

    commit () {
      return this._appendToJournal('reload', { })
    },

    async sync (immediate = false) {
      if (this.lastSync.getTime() + MAX_JOURNAL_ITEM_AGE < new Date().getTime()) {
        logger.debug('fs journal was not synced for a while, need full reload')
        // some journal items could have been already cleaned
        this.lastSync = new Date()
        return this._reloadAndSetVersion(immediate)
      }

      if (!(await fs.exists('fs.journal'))) {
        this.lastSync = new Date()
        return
      }

      if (!(await fs.exists('fs.version'))) {
        this.lastSync = new Date()
        return
      }

      const currentVersion = parseInt((await fs.readFile('fs.version')).toString(), 10)

      if (currentVersion === this.lastVersion) {
        // we don't have to read the journal because the last write is from this server
        this.lastSync = new Date()
        return
      }

      try {
        const journalContent = await fs.readFile('fs.journal')
        const lines = journalContent.toString().split('\n')
        let needsReload = false

        for (const line of lines) {
          if (line === '') {
            continue
          }

          const item = parse(line)

          if (item.version <= this.lastVersion) {
            continue
          }

          if (item.operation === 'insert') {
            transaction.getCurrentDocuments()[item.doc.$entitySet] = transaction.getCurrentDocuments()[item.doc.$entitySet].filter(d => d._id !== item.doc._id)
            transaction.getCurrentDocuments()[item.doc.$entitySet].push(item.doc)
          }

          if (item.operation === 'update') {
            transaction.getCurrentDocuments()[item.doc.$entitySet] = transaction.getCurrentDocuments()[item.doc.$entitySet].filter(d => d._id !== item.doc._id)
            transaction.getCurrentDocuments()[item.doc.$entitySet].push(item.doc)
          }

          if (item.operation === 'remove') {
            transaction.getCurrentDocuments()[item.doc.$entitySet] = transaction.getCurrentDocuments()[item.doc.$entitySet].filter(d => d._id !== item.doc._id)
          }

          if (item.operation === 'reload') {
            needsReload = true
            break
          }
        }

        if (needsReload) {
          return this._reloadAndSetVersion(immediate)
        }

        this.lastVersion = currentVersion
        await fs.writeFile('fs.version', this.lastVersion.toString())
      } catch (e) {
        logger.warn('fs journal is corrupted, reloading', e)

        const currentVersion = parseInt((await fs.readFile('fs.version')).toString(), 10)
        this.lastVersion = currentVersion + 1

        await fs.writeFile('fs.journal', serialize({
          operation: 'reload',
          timestamp: new Date(),
          version: this.lastVersion
        }, false) + '\n')

        await fs.writeFile('fs.version', this.lastVersion.toString())

        return this._reloadAndSetVersion(immediate)
      } finally {
        this.lastSync = new Date()
      }
    },

    close () {
      clearInterval(this.cleanInterval)
      clearInterval(this.syncInterval)
    },

    async _appendToJournal (operation, doc) {
      await this.sync()

      this.lastVersion += 1

      await fs.appendFile('fs.journal', serialize({
        operation,
        timestamp: new Date(),
        version: this.lastVersion,
        doc
      }, false) + '\n')

      await fs.writeFile('fs.version', this.lastVersion.toString())

      this.lastSync = new Date()
    },

    async _reloadAndSetVersion (immediate = false) {
      return reload({
        immediate,
        afterCb: async () => {
          const currentVersion = await loadVersion()
          this.lastVersion = currentVersion
        }
      })
    },

    async clean () {
      try {
        if (!(await fs.exists('fs.journal'))) {
          return
        }

        const journalCleanedContent = []
        const journalContent = await fs.readFile('fs.journal')
        const lines = journalContent.toString().split('\n')
        let changes = false
        for (const line of lines) {
          if (line === '') {
            continue
          }

          const item = parse(line)
          if (item.timestamp.getTime() > new Date().getTime() - MAX_JOURNAL_ITEM_AGE) {
            journalCleanedContent.push(line)
          } else {
            changes = true
          }
        }

        if (changes) {
          await fs.writeFile('fs.journal', journalCleanedContent.join('\n') + '\n')
          this.lastSync = new Date()
        }
      } catch (e) {
        logger.warn('Cleaning fs journal failed', e)
      }
    }
  }
}
