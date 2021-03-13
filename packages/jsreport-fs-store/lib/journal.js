const { serialize, parse, lock } = require('./customUtils')

const MAX_JOURNAL_ITEM_AGE = 60000

module.exports = ({
  fs,
  transaction,
  reload,
  logger
}) => {
  // THROW ERRORS when updating modified entity in the meantime
  // co compaction, performance
  return {
    async init () {
      this.lastSync = new Date()
      this.cleanInterval = setInterval(() => lock(fs, () => this.clean().catch((e) => logger.warn('Error when cleaning fs journal', e))), 60000)
      this.cleanInterval.unref()

      this.syncInterval = setInterval(() => lock(fs, () => this.sync()), 10000)
      this.syncInterval.unref()
    },

    insert (doc) {
      return this._appendToJournal('insert', doc)
    },

    update (doc) {
      return this._appendToJournal('update', doc)
    },

    remove (doc) {
      return this._appendToJournal('remove', { _id: doc._id, $entitySet: doc.$entitySet })
    },

    commit () {
      return this._appendToJournal('reload', { })
    },

    async sync () {
      if (this.lastSync.getTime() + MAX_JOURNAL_ITEM_AGE < new Date().getTime()) {
        logger.debug('fs journal wasnt synced for a while, need full reload')
        // some journal items could have been already cleaned
        this.lastSync = new Date()
        return reload()
      }

      if (!(await fs.exists('fs.journal'))) {
        this.lastSync = new Date()
        return
      }

      const journalStat = await fs.stat('fs.journal')
      if (journalStat.mtime < this.lastSync) {
        // we don't have to read the journal because the last write is from this server
        this.lastSync = new Date()
        return
      }

      try {
        const journalContent = await fs.readFile('fs.journal')
        const lines = journalContent.toString().split('\n')
        for (const line of lines) {
          if (line === '') {
            continue
          }

          const item = parse(line)

          if (item.timestamp < this.lastSync) {
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
            return reload()
          }
        }
      } catch (e) {
        logger.warn('fs journal is corrupted, reloading', e)
        await fs.writeFile('fs.journal', serialize({
          operation: 'reload',
          timestamp: new Date()
        }, false) + '\n')
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
      await this.sync()
      await fs.appendFile('fs.journal', serialize({
        operation,
        timestamp: new Date(),
        doc
      }, false) + '\n')
      this.lastSync = new Date()
    },

    async clean () {
      logger.debug('Cleaning journal')

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
