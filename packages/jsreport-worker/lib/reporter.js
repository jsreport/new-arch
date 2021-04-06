const util = require('util')
const path = require('path')
const fs = require('fs')
const events = require('events')
const mkdirp = require('mkdirp')
const Request = require('jsreport-core').Request
const createOrExtendError = require('jsreport-core/lib/util/createError')
const tempFilesHandler = require('jsreport-core/lib/util/tempFilesHandler')
const getAvailableRenderTimeoutFn = require('jsreport-core/lib/util/getAvailableRenderTimeout')

class Reporter extends events.EventEmitter {
  constructor (options = {}) {
    super()
    this.extensionsManager = {
      recipes: [],
      engines: []
    }

    this.version = '2.0.0'

    this.options = Object.assign(options, {
      rootDirectory: path.join(__dirname, '../'),
      templatingEngines: {
        nativeModules: [],
        modules: [],
        allowedModules: []
      },
      tempDirectory: options.workerTempDirectory,
      tempAutoCleanupDirectory: path.join(options.workerTempAutoCleanupDirectory)
    })

    if (!fs.existsSync(this.options.tempDirectory)) {
      mkdirp.sync(this.options.tempDirectory)
    }

    if (!fs.existsSync(this.options.tempAutoCleanupDirectory)) {
      mkdirp.sync(this.options.tempAutoCleanupDirectory)
    }

    this.options.extensions = this.options.extensions || {}

    this.documentStore = {
      registerComplexType: () => {},
      registerEntityType: () => {},
      registerEntitySet: () => {},
      model: {
        entityTypes: {
          TemplateType: {}
        }
      }
    }

    this.initializeListeners = getListenerMock()
    this.closeListeners = getListenerMock()
    this.beforeRenderListeners = getListenerMock()
    this.afterRenderListeners = getListenerMock()

    // NOTE: this uuid propagation was done here just to don't do changes to extensions
    // we can handle here that we want to propagate also the uuid when using the Request constructor
    this.Request = (obj, parent) => {
      let uuid

      if (obj.uuid != null) {
        uuid = obj.uuid
      } else if (parent != null && parent.uuid != null) {
        uuid = parent.uuid
      }

      const newReq = Request(obj, parent)

      if (uuid != null) {
        newReq.uuid = uuid
      }

      return newReq
    }

    const log = (level) => (...args) => {
      const lastArg = args.slice(-1)[0]
      let msgArgs = args
      let meta

      if (lastArg != null && typeof lastArg === 'object') {
        msgArgs = args.slice(0, -1)
        meta = lastArg
      }

      const msg = util.format.apply(util, msgArgs)

      if (level === 'debug' || level === 'info') {
        console.log(msg)
      } else if (level === 'warn') {
        console.warn(msg)
      } else if (level === 'error') {
        console.error(msg)
      }

      if (meta != null && meta.context) {
        meta.context.logs = meta.context.logs || []

        meta.context.logs.push({
          level: level,
          message: msg,
          timestamp: meta.timestamp || new Date().getTime()
        })
      }
    }

    this.logger = {
      debug: log('debug'),
      info: log('info'),
      error: log('error'),
      warn: log('warn')
    }
  }

  createListenerCollection () {
    return getListenerMock()
  }

  createError (message, options = {}) {
    return createOrExtendError(message, options)
  }

  async ensureTempDirectoryExists () {
    if (this.options.tempAutoCleanupDirectory == null) {
      throw new Error('Can not use ensureTempDirectoryExists when tempAutoCleanupDirectory option is not initialized, make sure to initialize jsreport first using jsreport.init()')
    }

    return tempFilesHandler.ensureTempDirectoryExists(this.options.tempAutoCleanupDirectory)
  }

  async readTempFile (filename, opts) {
    if (this.options.tempAutoCleanupDirectory == null) {
      throw new Error('Can not use readTempFile when tempAutoCleanupDirectory option is not initialized, make sure to initialize jsreport first using jsreport.init()')
    }

    return tempFilesHandler.readTempFile(this.options.tempAutoCleanupDirectory, filename, opts)
  }

  async writeTempFile (filenameFn, content, opts) {
    if (this.options.tempAutoCleanupDirectory == null) {
      throw new Error('Can not use writeTempFile when tempAutoCleanupDirectory option is not initialized, make sure to initialize jsreport first using jsreport.init()')
    }

    return tempFilesHandler.writeTempFile(this.options.tempAutoCleanupDirectory, filenameFn, content, opts)
  }

  async readTempFileStream (filename, opts) {
    if (this.options.tempAutoCleanupDirectory == null) {
      throw new Error('Can not use readTempFileStream when tempAutoCleanupDirectory option is not initialized, make sure to initialize jsreport first using jsreport.init()')
    }

    return tempFilesHandler.readTempFileStream(this.options.tempAutoCleanupDirectory, filename)
  }

  async writeTempFileStream (filenameFn, opts) {
    if (this.options.tempAutoCleanupDirectory == null) {
      throw new Error('Can not use writeTempFileStream when tempAutoCleanupDirectory option is not initialized, make sure to initialize jsreport first using jsreport.init()')
    }

    return tempFilesHandler.writeTempFileStream(this.options.tempAutoCleanupDirectory, filenameFn, opts)
  }

  getAvailableRenderTimeout (req, defaultValue) {
    return getAvailableRenderTimeoutFn(this, req, defaultValue)
  }
}

module.exports = Reporter

function getListenerMock () {
  return { insert: () => {}, add: () => {} }
}
