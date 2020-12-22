const EventEmitter = require('events')
const ListenerCollection = require('listener-collection')
const Request = require('./request')
const Folders = require('./folders')
const createOrExtendError = require('./createError')
const tempFilesHandler = require('./tempFilesHandler')

class Reporter extends EventEmitter {
  constructor (options) {
    super()

    this.options = options || {}
    this.Request = Request

    // since `reporter` instance will be used for other extensions,
    // it will quickly reach the limit of `10` listeners,
    // we increase the limit to Infinity for now,
    // later we should probably design
    // a way to detect possible memory leaks from extensions
    this.setMaxListeners(Infinity)

    this.version = require('../../package.json').version

    this.initializeListeners = this.createListenerCollection()
    this.afterRenderListeners = this.createListenerCollection()
    this.renderErrorListeners = this.createListenerCollection()
    this.closeListeners = this.createListenerCollection()
  }

  createListenerCollection () {
    return new ListenerCollection()
  }

  /**
   *  Creates a custom error or extends an existing one
   *
   * @public
   */
  createError (message, options = {}) {
    return createOrExtendError(message, options)
  }

  /**
   * Ensures that the jsreport autocleanup temp directory (options.tempAutoCleanupDirectory) exists by doing a mkdir call
   *
   * @public
   */
  async ensureTempDirectoryExists () {
    if (this.options.tempAutoCleanupDirectory == null) {
      throw new Error('Can not use ensureTempDirectoryExists when tempAutoCleanupDirectory option is not initialized, make sure to initialize jsreport first using jsreport.init()')
    }

    return tempFilesHandler.ensureTempDirectoryExists(this.options.tempAutoCleanupDirectory)
  }

  /**
   * Reads a file from the jsreport autocleanup temp directory (options.tempAutoCleanupDirectory)
   *
   * @public
   */
  async readTempFile (filename, opts) {
    if (this.options.tempAutoCleanupDirectory == null) {
      throw new Error('Can not use readTempFile when tempAutoCleanupDirectory option is not initialized, make sure to initialize jsreport first using jsreport.init()')
    }

    return tempFilesHandler.readTempFile(this.options.tempAutoCleanupDirectory, filename, opts)
  }

  /**
   * Creates a file into the jsreport autocleanup temp directory (options.tempAutoCleanupDirectory)
   * ensuring that the directory always exists
   *
   * @public
   */
  async writeTempFile (filenameFn, content, opts) {
    if (this.options.tempAutoCleanupDirectory == null) {
      throw new Error('Can not use writeTempFile when tempAutoCleanupDirectory option is not initialized, make sure to initialize jsreport first using jsreport.init()')
    }

    return tempFilesHandler.writeTempFile(this.options.tempAutoCleanupDirectory, filenameFn, content, opts)
  }

  /**
   * Reads a file as stream from the jsreport autocleanup temp directory (options.tempAutoCleanupDirectory)
   *
   * @public
   */
  async readTempFileStream (filename, opts) {
    if (this.options.tempAutoCleanupDirectory == null) {
      throw new Error('Can not use readTempFileStream when tempAutoCleanupDirectory option is not initialized, make sure to initialize jsreport first using jsreport.init()')
    }

    return tempFilesHandler.readTempFileStream(this.options.tempAutoCleanupDirectory, filename, opts)
  }

  /**
   * Creates a file as stream into the jsreport autocleanup temp directory (options.tempAutoCleanupDirectory)
   * ensuring that the directory always exists
   *
   * @public
   */
  async writeTempFileStream (filenameFn, opts) {
    if (this.options.tempAutoCleanupDirectory == null) {
      throw new Error('Can not use writeTempFileStream when tempAutoCleanupDirectory option is not initialized, make sure to initialize jsreport first using jsreport.init()')
    }

    return tempFilesHandler.writeTempFileStream(this.options.tempAutoCleanupDirectory, filenameFn, opts)
  }

  async init () {
    this.folders = Folders(this)
  }
}

module.exports = Reporter
