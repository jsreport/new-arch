const ExtensionsManager = require('./extensionsManager')
const DocumentStore = require('./documentStore')
const createLogger = require('./logger')
const runInSandbox = require('./sandbox/runInSandbox')
const createNoneEngine = require('./render/noneEngine')
const htmlRecipe = require('./render/htmlRecipe')
const defaultProxyExtend = require('./defaultProxyExtend')
const Reporter = require('../shared/reporter')
const BlobStorage = require('./blobStorage.js')
const Render = require('./render/render')

class WorkerReporter extends Reporter {
  constructor (workerData, executeMain) {
    const { options, documentStore, extensionsDefs } = workerData

    super(options)

    this._executeMain = executeMain
    this._initialized = false
    this._documentStoreData = documentStore
    this._requestContextMetaConfigCollection = new Map()
    this._proxyRegistrationFns = []
    this.requestModulesCache = new Map()
    this._workerActions = new Map()
    this._registerRenderAction()

    this.afterTemplatingEnginesExecutedListeners = this.createListenerCollection()
    this.validateRenderListeners = this.createListenerCollection()

    this.logger = createLogger(this.executeMainAction.bind(this))

    this.extensionsManager = ExtensionsManager(this, extensionsDefs)

    this.extendProxy((proxy, req) => defaultProxyExtend(this)(proxy, req))
  }

  async init () {
    if (this._initialized === true) {
      throw new Error('jsreport already initialized. Make sure init is called only once')
    }

    super.init()

    this._render = Render(this)
    await this.extensionsManager.init()

    this.documentStore = DocumentStore(this._documentStoreData, this.executeMainAction.bind(this))
    this.blobStorage = BlobStorage(this.executeMainAction.bind(this))

    this.addRequestContextMetaConfig('rootId', { sandboxReadOnly: true })
    this.addRequestContextMetaConfig('id', { sandboxReadOnly: true })
    this.addRequestContextMetaConfig('reportCounter', { sandboxReadOnly: true })
    this.addRequestContextMetaConfig('startTimestamp', { sandboxReadOnly: true })
    this.addRequestContextMetaConfig('logs', { sandboxReadOnly: true })
    this.addRequestContextMetaConfig('isChildRequest', { sandboxReadOnly: true })
    this.addRequestContextMetaConfig('originalInputDataIsEmpty', { sandboxReadOnly: true })
    this.addRequestContextMetaConfig('skipModificationDateUpdate', { sandboxHidden: true })

    this._runInSandbox = runInSandbox(this)

    const { compile: compileNone, execute: executeNone } = createNoneEngine()

    this.extensionsManager.engines.push({
      name: 'none',
      compile: compileNone,
      execute: executeNone
    })

    this.extensionsManager.recipes.push({
      name: 'html',
      execute: htmlRecipe
    })

    await this.initializeListeners.fire()

    this._initialized = true
  }

  /**
   * @public
   */
  addRequestContextMetaConfig (property, options) {
    this._requestContextMetaConfigCollection.set(property, options)
  }

  /**
   * @public
   */
  getRequestContextMetaConfig (property) {
    if (property === undefined) {
      const all = {}

      for (const [key, value] of this._requestContextMetaConfigCollection.entries()) {
        all[key] = value
      }

      return all
    }

    return this._requestContextMetaConfigCollection.get(property)
  }

  extendProxy (registrationFn) {
    this._proxyRegistrationFns.push(registrationFn)
  }

  createProxy ({ req }) {
    const proxyInstance = {}
    for (const fn of this._proxyRegistrationFns) {
      fn(proxyInstance, req)
    }
    return proxyInstance
  }

  render (req, parentReq) {
    return this._render(req, parentReq)
  }

  executeMainAction (actionName, data, req) {
    return this._executeMain(actionName, data, req)
  }

  async runInSandbox ({
    context,
    userCode,
    executionFn,
    onRequire,
    propertiesConfig
  }, req) {
    return this._runInSandbox({
      context,
      userCode,
      executionFn,
      onRequire,
      propertiesConfig
    }, req)
  }

  registerWorkerAction (actionName, fn) {
    this._workerActions.set(actionName, fn)
  }

  async executeWorkerAction (actionName, data, req) {
    const action = this._workerActions.get(actionName)
    if (!action) {
      throw new Error(`Worker action ${actionName} not registered`)
    }
    return action(data, req)
  }

  _registerRenderAction () {
    this.registerWorkerAction('render', async (data, req) => {
      const res = await this.render(req)

      const sharedBuf = new SharedArrayBuffer(res.content.byteLength)
      const buf = Buffer.from(sharedBuf)

      res.content.copy(buf)

      return {
        meta: res.meta,
        content: buf
      }
    })
  }
}

module.exports = WorkerReporter
