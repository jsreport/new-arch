/*!
 * Copyright(c) 2018 Jan Blaha
 *
 * Reporter main class including all methods jsreport-core exposes.
 */
const path = require('path')
const { Readable } = require('stream')
const Reaper = require('reap2')
const optionsLoad = require('./optionsLoad')
const { createLogger, configureLogger, silentLogs } = require('./logger')
const checkEntityName = require('./validateEntityName')
const DocumentStore = require('./store/documentStore')
const BlobStorage = require('./blobStorage/blobStorage')
const ExtensionsManager = require('./extensions/extensionsManager')
const Settings = require('./settings')
const SchemaValidator = require('./schemaValidator')
const { getRootSchemaOptions, extendRootSchemaOptions } = require('./optionsSchema')
const Templates = require('./templates')
const Folders = require('./folders')
const WorkersManager = require('advanced-workers')
const { validateDuplicatedName } = require('./folders/validateDuplicatedName')
const { validateReservedName } = require('./folders/validateReservedName')
const setupValidateId = require('./store/setupValidateId')
const setupValidateShortid = require('./store/setupValidateShortid')
const documentStoreActions = require('./store/mainActions')
const blobStorageActions = require('./blobStorage/mainActions')
const Reporter = require('../shared/reporter')
const Request = require('../shared/request')
const generateRequestId = require('../shared/generateRequestId')
const Profiler = require('./profiler')
const Monitoring = require('./monitoring')

class MainReporter extends Reporter {
  constructor (options, defaults) {
    super(options)

    this.defaults = defaults || {}
    this._fnAfterConfigLoaded = () => {}
    this._reaperTimerRef = null
    this._extraPathsToCleanupCollection = new Set()

    this._initialized = false
    this._initializing = false
    this._mainActions = new Map()

    this.settings = new Settings()
    this.extensionsManager = ExtensionsManager(this)

    this.optionsValidator = new SchemaValidator({
      rootSchema: getRootSchemaOptions()
    })

    this.entityTypeValidator = new SchemaValidator()

    this.logger = createLogger()
    this.beforeMainActionListeners = this.createListenerCollection()
  }

  discover () {
    this.options.discover = true
    return this
  }

  /**
   * Manual registration of the extension. Once calling `use` the auto discovery of extensions is turned off if not explicitly
   * turned on.
   * jsreport.use(require('jsreport-jsrender')())
   * @param {Object || Function} extensions
   * @return {Reporter} for chaining
   * @public
   */
  use (extension) {
    this.extensionsManager.use(extension)
    return this
  }

  async extensionsLoad (opts) {
    const appliedConfigFile = await optionsLoad({
      defaults: this.defaults,
      options: this.options,
      validator: this.optionsValidator,
      fallbackParentModuleDirectory: path.dirname(module.parent.filename),
      onConfigLoaded: async () => {
        await this._fnAfterConfigLoaded(this)
      }
    })

    configureLogger(this.logger, this.options.logger)

    if (this.options.logger && this.options.logger.silent === true) {
      silentLogs(this.logger)
    }

    this.logger.info(`Initializing jsreport@${this.version} in ${this.options.mode} mode${
      this.options.loadConfig ? ` using configuration file: ${appliedConfigFile || 'none'}` : ''
    }`)

    await this.extensionsManager.load(opts)

    const newRootSchema = extendRootSchemaOptions(
      getRootSchemaOptions(),
      this.extensionsManager.availableExtensions.map(ex => ({
        name: ex.name,
        schema: ex.optionsSchema
      }))
    )

    this.optionsValidator.setRootSchema(newRootSchema)

    const rootOptionsValidation = this.optionsValidator.validateRoot(this.options, {
      rootPrefix: 'rootOptions',
      // extensions was validated already in extensions load
      ignore: ['properties.extensions']
    })

    if (!rootOptionsValidation.valid) {
      throw new Error(`options contain values that does not match the defined full root schema. ${rootOptionsValidation.fullErrorMessage}`)
    }

    return this
  }

  /**
   * Hook to alter configuration after it was loaded and merged
   * jsreport.afterConfigLoaded(function(reporter) { .. do your stuff ..})
   *
   *
   * @public
   */
  afterConfigLoaded (fn) {
    this._fnAfterConfigLoaded = fn
    return this
  }

  /**
   * Required async method to be called before rendering.
   *
   * @return {Promise} initialization is done, promise value is Reporter instance for chaining
   * @public
   */
  async init () {
    if (this._initialized || this._initializing) {
      throw new Error('jsreport already initialized or just initializing. Make sure init is called only once')
    }

    super.init()

    this._initializing = true

    if (this.compilation) {
      this.compilation.resource('sandbox.js', require.resolve('vm2/lib/sandbox.js'))
      this.compilation.resource('contextify.js', require.resolve('vm2/lib/contextify.js'))
    }

    try {
      this._registerLogMainAction()
      await this.extensionsLoad()

      this.documentStore = DocumentStore(Object.assign({}, this.options, { logger: this.logger }), this.entityTypeValidator, this.encryption)
      documentStoreActions(this)
      this.blobStorage = BlobStorage(this, this.options)
      blobStorageActions(this)
      Templates(this)
      Profiler(this)
      Monitoring(this)

      this.folders = Object.assign(this.folders, Folders(this))

      this.settings.registerEntity(this.documentStore)

      this.options.blobStorage = this.options.blobStorage || {}

      if (this.options.blobStorage.provider == null) {
        this.options.blobStorage.provider = this.options.store.provider
      }

      if (this.options.blobStorage.provider === 'memory') {
        this.blobStorage.registerProvider(require('./blobStorage/inMemoryProvider.js')(this.options))
      }

      await this.extensionsManager.init()

      this.logger.info(`Using general timeout for rendering (reportTimeout: ${this.options.reportTimeout})`)

      if (this.options.store.provider === 'memory') {
        this.logger.info(`Using ${this.options.store.provider} provider for template store. The saved templates will be lost after restart`)
      } else {
        this.logger.info(`Using ${this.options.store.provider} provider for template store.`)
      }

      await this.documentStore.init()
      await this.blobStorage.init()
      await this.settings.init(this.documentStore, this.authorization)

      const extensionsForWorkers = this.extensionsManager.extensions.filter(e => e.worker)

      const workersManagerOptions = {
        ...this.options.sandbox,
        options: { ...this.options },
        // we do map and copy to unproxy the value
        extensionsDefs: extensionsForWorkers.map(e => Object.assign({}, e)),
        documentStore: {
          // we do copy to unproxy the value of entityTypes
          model: {
            ...this.documentStore.model,
            entityTypes: { ...this.documentStore.model.entityTypes }
          },
          collections: Object.keys(this.documentStore.collections)
        }
      }

      const workersManagerSystemOptions = {
        numberOfWorkers: 1,
        workerModule: path.join(__dirname, '../worker', 'workerHandler.js'),
        resourceLimits: this.options.workers.resourceLimits
      }

      this._workersManager = this._workersManagerFactory
        ? this._workersManagerFactory(workersManagerOptions, workersManagerSystemOptions)
        : WorkersManager(workersManagerOptions, workersManagerSystemOptions, this.logger)

      const workersStart = new Date().getTime()

      this.logger.info('Initializing worker threads')

      this.logger.debug(`Extensions in workers: ${extensionsForWorkers.map((e) => e.name).join(', ')}`)

      await this._workersManager.init(workersManagerOptions)

      this.logger.info(`${this.options.workers.numberOfWorkers} worker threads initialized in ${new Date().getTime() - workersStart}ms`)

      // adding the validation of shortid after extensions has been loaded
      setupValidateId(this)
      setupValidateShortid(this)

      await this.initializeListeners.fire()

      this._startReaper(this.getPathsToWatchForAutoCleanup())

      this.extensionsManager.recipes.push({
        name: 'html'
      })

      this.extensionsManager.engines.push({
        name: 'none'
      })

      this.monitoring.init()

      this.logger.info('reporter initialized')
      this._initialized = true
      return this
    } catch (e) {
      this.logger.error(`Error occured during reporter init: ${e.stack}`)
      throw e
    }
  }

  /**
   * @public
   */
  addPathToWatchForAutoCleanup (customPath) {
    this._extraPathsToCleanupCollection.add(customPath)
  }

  /**
   * @public
   */
  getPathsToWatchForAutoCleanup () {
    return [this.options.tempAutoCleanupDirectory].concat(Array.from(this._extraPathsToCleanupCollection.values()))
  }

  async checkValidEntityName (c, doc, req) {
    if (!this.documentStore.model.entitySets[c].entityTypeDef.name) {
      return
    }

    checkEntityName(doc.name)

    await validateDuplicatedName(this, c, doc, undefined, req)

    await validateReservedName(this, c, doc)
  }

  /**
   * Main method for invoking rendering
   * render({ template: { content: 'foo', engine: 'none', recipe: 'html' }, data: { foo: 'hello' } })
   *
   * @request {Object}
   * @return {Promise} response.content is output buffer, response.stream is output stream, response.headers contains http applicable headers
   *
   * @public
   */
  async render (req, parentReq) {
    if (!this._initialized) {
      throw new Error('Not initialized, you need to call jsreport.init().then before rendering')
    }

    req.context = req.context || {}
    req.context.rootId = req.context.rootId || generateRequestId()

    let request, response
    const worker = await this._workersManager.allocate({
      timeout: this.options.reportTimeout,
      ...req
    })

    let workerAborted
    if (parentReq && !parentReq.__isJsreportRequest__) {
      const options = parentReq
      parentReq = null

      if (options.abortEmitter) {
        options.abortEmitter.once('abort', () => {
          workerAborted = true
          worker.release(req)
        })
      }
    }

    try {
      if (workerAborted) {
        throw this.createError('Request aborted by client')
      }

      if (req.rawContent) {
        const result = await worker.execute({
          actionName: 'parse',
          req,
          data: {}
        }, {
          timeout: this.options.reportTimeout
        })
        req = result
      }

      response = { meta: {} }
      request = Request(req, parentReq)

      // TODO: we will probably validate in the thread
      if (this.entityTypeValidator.getSchema('TemplateType') != null) {
        const templateValidationResult = this.entityTypeValidator.validate('TemplateType', request.template, { rootPrefix: 'template' })

        if (!templateValidationResult.valid) {
          throw this.createError(`template input in request contain values that does not match the defined schema. ${templateValidationResult.fullErrorMessage}`, {
            statusCode: 400
          })
        }
      }

      request.context.rootId = request.context.rootId || generateRequestId()
      request.context.id = request.context.rootId

      let reportTimeout = this.options.reportTimeout

      if (
        this.options.enableRequestReportTimeout &&
      request.options &&
      request.options.timeout != null
      ) {
        reportTimeout = request.options.timeout
      }

      await this.beforeRenderListeners.fire(request, response)

      if (request.context.isFinished) {
        response.stream = Readable.from(response.content)
        return response
      }

      if (workerAborted) {
        throw this.createError('Request aborted by client')
      }

      const responseResult = await this.executeWorkerAction('render', {}, {
        timeout: reportTimeout + this.options.reportTimeoutMargin,
        worker
      }, request)

      Object.assign(response, responseResult)
      await this.afterRenderListeners.fire(request, response)
      response.stream = Readable.from(response.content)
      return response
    } catch (err) {
      if (err.code === 'WORKER_TIMEOUT') {
        err.message = 'Report timeout'
      }
      if (!err.logged) {
        this.logger.error(`Report render failed: ${err.message}${err.stack != null ? ' ' + err.stack : ''}`, request)
      }
      await this.renderErrorListeners.fire(request, response, err)
      throw err
    } finally {
      if (!workerAborted) {
        await worker.release(req)
      }
    }
  }

  generateRequestId () {
    return generateRequestId()
  }

  registerWorkersManagerFactory (workersManagerFactory) {
    this._workersManagerFactory = workersManagerFactory
  }

  /**
   *
   * @public
   */
  async close () {
    this.logger.info('Closing jsreport instance')

    await this.monitoring.close()

    if (this._reaperTimerRef) {
      clearInterval(this._reaperTimerRef)
    }

    if (this._workersManager) {
      await this._workersManager.close()
    }

    await this.closeListeners.fire()

    if (this.documentStore) {
      await this.documentStore.close()
    }

    this.logger.info('jsreport instance has been closed')

    return this
  }

  registerMainAction (actionName, fn) {
    this._mainActions.set(actionName, fn)
  }

  async _invokeMainAction (data, req) {
    await this.beforeMainActionListeners.fire(data.actionName, data.data, req)
    if (!this._mainActions.has(data.actionName)) {
      throw this.createError(`Main process action ${data.actionName} wasn't registered`)
    }
    return this._mainActions.get(data.actionName)(data.data, req)
  }

  _registerLogMainAction () {
    this.registerMainAction('log', (log, req) => {
      this.logger[log.level](log.message, { ...req, ...log.meta, timestamp: log.timestamp })
    })
  }

  async executeWorkerAction (actionName, data, options = {}, req) {
    req.context.rootId = req.context.rootId || generateRequestId()

    const worker = options.worker ? options.worker : await this._workersManager.allocate(req)

    try {
      const result = await worker.execute({
        actionName,
        data,
        // we set just known props, to avoid clonning failures on expres req properties
        req: {
          context: req.context,
          template: req.template,
          data: req.data,
          options: req.options
        }
      }, {
      // TODO add worker timeout
        timeout: options.timeout || 60000,
        timeoutErrorMessage: options.timeoutErrorMessage || ('Timeout during worker action ' + actionName),
        executeMain: async (data) => {
          return this._invokeMainAction(data, req)
        }
      })
      this._workersManager.convertUint8ArrayToBuffer(result)
      return result
    } finally {
      if (!options.worker) {
        await worker.release(req)
      }
    }
  }

  /**
   * Periodical cleaning of folders where recipes are storing files like source html for pdf rendering
   *
   * @private
   */
  _startReaper (dir) {
    const dirsToWatch = !Array.isArray(dir) ? [dir] : dir

    if (this.options.autoTempCleanup === false) {
      return
    }

    const threshold = this.options.reportTimeout > 180000 ? this.options.reportTimeout : 180000

    this.logger.info(`Starting temp files cleanup with ${threshold}ms threshold`)

    const reaper = new Reaper({ threshold })

    dirsToWatch.forEach(d => reaper.watch(d))

    reaper.start((err, files) => {
      if (err) {
        this.logger.error(`Failed to start auto cleanup: ${err.stack}`)
      }
    })

    this._reaperTimerRef = setInterval(() => {
      try {
        reaper.start((err, files) => {
          if (err) {
            // NOT logging the error anymore because it was confusing users that something bad was happening
            // this.logger.error('Failed to delete temp file: ' + err)
          }
        })
      } catch (e) {
        // NOT logging the error anymore because it was confusing users that something bad was happening
        // catch error in case the reaper can not read directory
        // this.logger.error('Failed to run reaper: ' + e)
      }
    }, 30000 /* check every 30s for old files */)

    this._reaperTimerRef.unref()
  }
}

module.exports = MainReporter
