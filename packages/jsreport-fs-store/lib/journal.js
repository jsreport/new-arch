const { serialize, parse, lock } = require('./customUtils')

const MAX_JOURNAL_ITEM_AGE = 60000

module.exports = ({
  fs,
  getCurrentDocuments,
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
    return parseInt(versionInFile, 10)
  }

  // TODO THROW ERRORS when updating modified entity in the meantime
  return {
    async init () {
      this.lastVersion = await loadVersion()
      this.lastSync = new Date()
      this.cleanInterval = setInterval(() => queue.push(() => lock(fs, () => this.clean().catch((e) => logger.warn('Error when cleaning fs journal', e)))), 60000)
      this.cleanInterval.unref()

      this.waitAndSync = () => queue.push(() => lock(fs, () => this.sync()))

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

    async commit () {
      this.lastVersion = await loadVersion()
      return this._appendToJournal('reload', { })
    },

    async sync () {
      const currentVersion = await loadVersion()

      if (this.lastSync.getTime() + MAX_JOURNAL_ITEM_AGE < new Date().getTime()) {
        logger.debug('fs journal was not synced for a while, need full reload')
        // some journal items could have been already cleaned
        this.lastSync = new Date()
        this.loadVersion = currentVersion
        return reload()
      }

      if (currentVersion === this.lastVersion) {
        // we don't have to read the journal because the last write is from this server
        this.lastSync = new Date()
        return
      }

      if (!(await fs.exists('fs.journal'))) {
        this.loadVersion = currentVersion
        this.lastSync = new Date()
        return
      }

      try {
        const journalContent = await fs.readFile('fs.journal')
        const lines = journalContent.toString().split('\n')
        let needsReload = false

        // eslint-disable-next-line no-unused-vars
        for (const line of lines) {
          if (line === '') {
            continue
          }

          const item = parse(line)

          if (item.version <= this.lastVersion) {
            continue
          }

          if (item.operation === 'insert') {
            getCurrentDocuments()[item.doc.$entitySet] = getCurrentDocuments()[item.doc.$entitySet].filter(d => d._id !== item.doc._id)
            getCurrentDocuments()[item.doc.$entitySet].push(item.doc)
          }

          if (item.operation === 'update') {
            getCurrentDocuments()[item.doc.$entitySet] = getCurrentDocuments()[item.doc.$entitySet].filter(d => d._id !== item.doc._id)
            getCurrentDocuments()[item.doc.$entitySet].push(item.doc)
          }

          if (item.operation === 'remove') {
            getCurrentDocuments()[item.doc.$entitySet] = getCurrentDocuments()[item.doc.$entitySet].filter(d => d._id !== item.doc._id)
          }

          if (item.operation === 'reload') {
            needsReload = true
            break
          }
        }

        if (needsReload) {
          await reload()
        }

        this.lastVersion = currentVersion
      } catch (e) {
        logger.warn('fs journal is corrupted, reloading', e)

        this.lastVersion = currentVersion
        await this._appendToJournal('reload', { })

        return reload()
      } finally {
        this.lastSync = new Date()
      }
    },

    close () {
      clearInterval(this.cleanInterval)
      clearInterval(this.syncInterval)
    },

    async _appendToJournal (operation, doc) {
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

    async clean () {
      try {
        if (!(await fs.exists('fs.journal'))) {
          return
        }

        const journalCleanedContent = []
        const journalContent = await fs.readFile('fs.journal')
        const lines = journalContent.toString().split('\n')
        let changes = false
        // eslint-disable-next-line no-unused-vars
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
