const { nanoid } = require('nanoid')
const ExtensionsManager = require('./extensionsManager')
const DocumentStore = require('./documentStore')
const createLogger = require('./logger')
const render = require('./render/render')
const safeSandbox = require('./render/safeSandbox')
const createNoneEngine = require('./render/noneEngine')
const htmlRecipe = require('./render/htmlRecipe')
const registerProxyMethods = require('./registerProxyMethods')
const Reporter = require('../shared/reporter')

class WorkerReporter extends Reporter {
  #registry
  #initialized
  #documentStoreData
  #requestContextMetaConfigCollection
  #proxyRegistrationFns

  constructor (workerData, registry) {
    const { options, documentStore, extensionsDefs } = workerData

    super(options)

    this.#registry = registry
    this.#initialized = false
    this.#documentStoreData = documentStore
    this.#requestContextMetaConfigCollection = new Map()
    this.#proxyRegistrationFns = []

    this.requestModulesCache = new Map()

    this.beforeRenderListeners = this.createListenerCollection()
    this.afterTemplatingEnginesExecutedListeners = this.createListenerCollection()
    this.validateRenderListeners = this.createListenerCollection()

    this.extendProxy = this.extendProxy.bind(this)
    this.createProxy = this.createProxy.bind(this)

    this.logger = createLogger(registry)

    this.extensionsManager = ExtensionsManager(this, extensionsDefs)

    this.extendProxy((proxy, defineMethod) => registerProxyMethods(this, proxy, defineMethod))
  }

  async init () {
    if (this.#initialized === true) {
      throw new Error('jsreport already initialized. Make sure init is called only once')
    }

    super.init()

    await this.extensionsManager.init()

    this.documentStore = DocumentStore(this.#registry, this.#documentStoreData)

    this.addRequestContextMetaConfig('rootId', { sandboxReadOnly: true })
    this.addRequestContextMetaConfig('id', { sandboxReadOnly: true })
    this.addRequestContextMetaConfig('reportCounter', { sandboxReadOnly: true })
    this.addRequestContextMetaConfig('startTimestamp', { sandboxReadOnly: true })
    this.addRequestContextMetaConfig('logs', { sandboxReadOnly: true })
    this.addRequestContextMetaConfig('isChildRequest', { sandboxReadOnly: true })
    this.addRequestContextMetaConfig('originalInputDataIsEmpty', { sandboxReadOnly: true })
    this.addRequestContextMetaConfig('skipModificationDateUpdate', { sandboxHidden: true })

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

    this.#initialized = true
  }

  /**
   * @public
   */
  addRequestContextMetaConfig (property, options) {
    this.#requestContextMetaConfigCollection.set(property, options)
  }

  /**
   * @public
   */
  getRequestContextMetaConfig (property) {
    if (property === undefined) {
      const all = {}

      for (const [key, value] of this.#requestContextMetaConfigCollection.entries()) {
        all[key] = value
      }

      return all
    }

    return this.#requestContextMetaConfigCollection.get(property)
  }

  extendProxy (registrationFn) {
    this.#proxyRegistrationFns.push(registrationFn)
  }

  createProxy (contextParam, { afterMethodExecute } = {}) {
    const context = Object.assign({}, contextParam)
    context.require = context.require || require

    const defineMethod = (method) => {
      return async (...params) => {
        const methodResult = await method(context, ...params)

        if (typeof afterMethodExecute === 'function') {
          afterMethodExecute(methodResult)
        }

        return methodResult
      }
    }

    return this.#proxyRegistrationFns.reduce((proxyInstance, registrationFn) => {
      registrationFn(proxyInstance, defineMethod)
      return proxyInstance
    }, {})
  }

  render (req, parentReq) {
    return render(this, req, parentReq)
  }

  async runInSandbox (fn, options = {}) {
    const { getContext, onEval } = options
    let initialContext

    if (getContext != null) {
      initialContext = await getContext()
    } else {
      initialContext = {}
    }

    const runId = `#${nanoid()}#`
    const runIdRestore = `${runId}__restore`

    initialContext[runId] = fn

    const {
      sandbox: sandboxContext,
      restore,
      run
    } = safeSandbox(
      initialContext,
      {
        errorPrefix: options.errorPrefix,
        onLog: options.onLog,
        formatError: options.formatError,
        propertiesConfig: options.propertiesConfig,
        globalModules: options.globalModules || [],
        allowedModules: options.allowedModules || [],
        requirePaths: options.requirePaths || [],
        requireMap: options.requireMap,
        modulesCache: options.sandboxModulesCache
      }
    )

    sandboxContext[runIdRestore] = restore

    if (onEval) {
      const evalFn = (code, opts = {}) => {
        const defaultEvalFilename = opts.filename ? opts.filename : `eval-sandbox${runId}.js`

        const executionCode = `
          ;(async () => {
            ${code}
          })();
        `

        return run(executionCode, {
          filename: defaultEvalFilename,
          mainFilename: defaultEvalFilename,
          mainSource: executionCode,
          ...opts
        })
      }

      await onEval({ context: sandboxContext, run: evalFn, restore })
    }

    const executionCode = `
      ;(async () => {
        const fn = this['${runId}']
        const restore = this['${runIdRestore}']
        delete this['${runId}']
        delete this['${runIdRestore}']
        return fn({ context: this, restore })
      })();
    `

    const defaultMainFilename = options.fileInfo && options.fileInfo.filename ? (
      options.fileInfo.filename
    ) : `main-eval-sandbox${runId}.js`

    const promise = run(executionCode, {
      filename: defaultMainFilename,
      mainFilename: defaultMainFilename,
      mainSource: executionCode,
      ...options.fileInfo
    })

    const result = await promise

    return result
  }
}

module.exports = WorkerReporter
