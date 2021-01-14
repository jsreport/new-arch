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
const Folders = require('./folders')
const WorkersManager = require('advanced-workers')
const { validateDuplicatedName } = require('./folders/validateDuplicatedName')
const { validateReservedName } = require('./folders/validateReservedName')
const setupValidateId = require('./store/setupValidateId')
const setupValidateHumanReadableKey = require('./store/setupValidateHumanReadableKey')
const documentStoreActions = require('./store/mainActions')
const blobStorageActions = require('./blobStorage/mainActions')
const Reporter = require('../shared/reporter')
const Request = require('../shared/request')
const generateRequestId = require('../shared/generateRequestId')
const extend = require('node.extend.without.arrays')

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
    const [userSuppliedOptions, appliedConfigFile] = await optionsLoad({
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

    if (userSuppliedOptions.templatingEngines && userSuppliedOptions.templatingEngines.timeout != null && this.options.reportTimeout != null) {
      this.logger.warn('"templatingEngines.timeout" configuration is ignored when "reportTimeout" is set')
    } else if (userSuppliedOptions.templatingEngines && userSuppliedOptions.templatingEngines.timeout != null) {
      this.logger.warn('"templatingEngines.timeout" configuration is deprecated and will be removed in the future, please use "reportTimeout" instead')
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
      this.blobStorage = BlobStorage(this.options)
      blobStorageActions(this)

      this.documentStore.registerEntityType('TemplateType', {
        content: { type: 'Edm.String', document: { extension: 'html', engine: true } },
        recipe: { type: 'Edm.String' },
        // helper accepts both string, and an object when using in-process
        helpers: { type: 'Edm.String', document: { extension: 'js' }, schema: { type: 'object' } },
        engine: { type: 'Edm.String' }
      }, true)

      this.folders = Object.assign(this.folders, Folders(this))

      this.settings.registerEntity(this.documentStore)

      this.options.blobStorage = this.options.blobStorage || {}

      if (!this.options.blobStorage.provider || this.options.blobStorage.provider === 'memory') {
        this.blobStorage.registerProvider(require('./blobStorage/inMemoryBlobStorageProvider.js')(this.options))
      }

      if (this.options.blobStorage.provider === 'fs') {
        this.blobStorage.registerProvider(require('./blobStorage/fileSystemBlobStorageProvider.js')(this.options))
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

      this._workersManager = new WorkersManager({
        ...this.options.templatingEngines,
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
      }, {
        numberOfWorkers: 1,
        workerModule: path.join(__dirname, '../worker', 'workerHandler.js')
      }, this.logger)

      const workersStart = new Date().getTime()

      this.logger.info('Initializing worker threads')

      this.logger.debug(`Extensions in workers: ${extensionsForWorkers.map((e) => e.name).join(', ')}`)

      await this._workersManager.init()

      this.logger.info(`${this.options.templatingEngines.numberOfWorkers} worker threads initialized in ${new Date().getTime() - workersStart}ms`)

      // adding the validation of humanReadableKey after extensions has been loaded
      setupValidateId(this)
      setupValidateHumanReadableKey(this)

      await this.initializeListeners.fire()

      await this._startReaper(this.getPathsToWatchForAutoCleanup())

      this.extensionsManager.recipes.push({
        name: 'html'
      })

      this.extensionsManager.engines.push({
        name: 'none'
      })

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
    const publicKey = this.documentStore.model.entitySets[c].entityTypePublicKey

    if (!publicKey) {
      return
    }

    checkEntityName(doc[publicKey])

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

    const request = Request(req, parentReq)

    // TODO: we will probably validate in the thread
    if (this.entityTypeValidator.getSchema('TemplateType') != null) {
      const templateValidationResult = this.entityTypeValidator.validate('TemplateType', request.template, { rootPrefix: 'template' })

      if (!templateValidationResult.valid) {
        throw this.createError(`template input in request contain values that does not match the defined schema. ${templateValidationResult.fullErrorMessage}`, {
          statusCode: 400
        })
      }
    }

    request.context.rootId = generateRequestId()
    request.context.id = request.context.rootId

    let reportTimeout = this.options.reportTimeout

    if (
      this.options.enableRequestReportTimeout &&
      request.options &&
      request.options.timeout != null
    ) {
      reportTimeout = request.options.timeout
    }

    const response = { meta: {} }
    let responseResult

    await this.beforeRenderListeners.fire(request, response)

    if (request.context.isFinished) {
      response.stream = Readable.from(response.content)
      return response
    }

    try {
      responseResult = await this.executeWorkerAction('render', {}, {
        timeout: reportTimeout,
        timeoutErrorMessage: 'Report timeout during render'
      }, request)

      Object.assign(response, responseResult)
      await this.afterRenderListeners.fire(request, response)
      response.stream = Readable.from(response.content)
    } catch (err) {
      await this.renderErrorListeners.fire(request, response, err)
      throw err
    }

    return response
  }

  /**
   *
   * @public
   */
  async close () {
    this.logger.info('Closing jsreport instance')

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

  _invokeMainAction (data) {
    return this._mainActions.get(data.actionName)(data.data, data.req)
  }

  _registerLogMainAction () {
    this.registerMainAction('log', (log, req) => {
      this.logger[log.level](log.message, { ...req, ...log.meta, timestamp: log.timestamp })
    })
  }

  async executeWorkerAction (actionName, data, options = {}, req) {
    req.context.rootId = req.context.rootId || generateRequestId()

    return this._workersManager.executeWorker({
      actionName,
      data,
      req
    }, {
      // TODO add worker timeout
      timeout: options.timeout || 60000,
      timeoutErrorMessage: options.timeoutErrorMessage || ('Timeout during worker action ' + actionName),
      executeMain: async (data) => {
        extend(true, req, data.req)
        const result = await this._invokeMainAction(data, req)
        return result
      }
    })
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

    // 3 minutes old files will be deleted
    const reaper = new Reaper({ threshold: 180000 })

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
