import PropTypes from 'prop-types'
import React from 'react'
import ReactDom from 'react-dom'
import { NativeTypes } from 'react-dnd-html5-backend'
import ReactList from 'react-list'
import superagent from 'superagent'
import shortid from 'shortid'
import fileSaver from 'filesaver.js-npm'
import api, { methods } from './helpers/api'
import { getCurrentTheme, setCurrentTheme } from './helpers/theme'
import SplitPane from './components/common/SplitPane/SplitPane'
import Popover from './components/common/Popover'
import Popup from './components/common/Popup'
import FileInput from './components/common/FileInput/FileInput'
import MultiSelect from './components/common/MultiSelect/index'
import EntityRefSelect from './components/common/EntityRefSelect/index'
import TextEditor from './components/Editor/TextEditor'
import EntityTree from './components/EntityTree/EntityTree'
import EntityTreeButton from './components/EntityTree/EntityTreeButton'
import Preview from './components/Preview/Preview'
import FramePreview from './components/Preview/FramePreview'
import NewEntityModal from './components/Modals/NewEntityModal'
import storeMethods from './redux/methods'
import * as editor from './redux/editor'
import * as entities from './redux/entities'
import * as progress from './redux/progress'
import * as settings from './redux/settings'
import * as configuration from './lib/configuration'
import rootUrl from './helpers/rootUrl'
import { openModal, isModalOpen } from './helpers/openModal'
import resolveUrl from './helpers/resolveUrl'
import { findTextEditor } from './helpers/textEditorInstance'
import babelRuntime from './lib/babelRuntime'
import bluebird from 'bluebird'
import io from 'socket.io-client'

/**
 * Main facade and API for extensions. Exposed as global variable Studio. It can be also imported from jsreport-studio
 * when using extensions default webpack configuration
 * @class
 * @public
 */
class Studio {
  /** event listeners **/

  /**
   * Array of async functions invoked in sequence during initialization
   * @returns {Function[]}
   */
  get initializeListeners () {
    return configuration.initializeListeners
  }

  /**
   * Array of async functions invoked in sequence after the app has been rendered
   * @returns {Function[]}
   */
  get readyListeners () {
    return configuration.readyListeners
  }

  /**
   * Array of async functions invoked in sequence when run template preview process starts.
   * @returns {Function[]}
   */
  get runListeners () {
    return configuration.runListeners
  }

  /**
   * Array of functions invoked in sequence when a report preview is render.
   * It should return an object describing the styles to apply to the Frame preview of the report
   * @returns {Function[]}
   */
  get reportPreviewStyleResolvers () {
    return configuration.reportPreviewStyleResolvers
  }

  /**
   * Array of functions invoked in sequence when new entity is about to be added.
   * @returns {Function[]}
   */
  get entityNewListeners () {
    return configuration.entityNewListeners
  }

  /**
   * Array of async functions invoked in sequence when editor entity save starts.
   * @returns {Function[]}
   */
  get entitySaveListeners () {
    return configuration.entitySaveListeners
  }

  get textEditorInitializeListeners () {
    return configuration.textEditorInitializeListeners
  }

  get textEditorCreatedListeners () {
    return configuration.textEditorCreatedListeners
  }

  /** /event listeners **/

  /** initial configuration **/

  /**
   * Add new entity set, which will be automatically loaded through OData and displayed in the entity tree
   * @example Studio.addEntitySet({ name: 'data', visibleName: 'sample data' })
   * @param {Object} entitySet
   */
  addEntitySet (entitySet) {
    entitySet.referenceAttributes = [...new Set([...(entitySet.referenceAttributes || []), 'name', 'shortid'])]
    configuration.entitySets[entitySet.name] = entitySet
  }

  /**
   * Add React component which will be displayed in toolbar
   *
   * @param {ReactComponent|Function} toolbarComponent
   * @param {String} position left, right, settings or settingsBottom
   */
  addToolbarComponent (toolbarComponent, position = 'left') {
    configuration.toolbarComponents[position].push(toolbarComponent)
  }

  /**
   * Add React component which will be displayed as a wrapper/container for entity tree
   *
   * @param {ReactComponent|Function} entityTreeWrapperComponent
   */
  addEntityTreeWrapperComponent (entityTreeWrapperComponent) {
    configuration.entityTreeWrapperComponents.push(entityTreeWrapperComponent)
  }

  /**
   * Add React component which will be displayed in toolbar of entity tree
   *
   * @param {ReactComponent|Function} entityTreeToolbarComponent
   */
  addEntityTreeToolbarComponent (entityTreeToolbarComponent, position = 'single') {
    configuration.entityTreeToolbarComponents[position].push(entityTreeToolbarComponent)
  }

  /**
   * Add React component which will be displayed when rendering an item of entity tree
   *
   * @param {ReactComponent|Function} entityTreeItemComponent
   * @param {String} position right, groupRight or container
   */
  addEntityTreeItemComponent (entityTreeItemComponent, position = 'right') {
    configuration.entityTreeItemComponents[position].push(entityTreeItemComponent)
  }

  /**
   *  Add a fn to resolve items for the context menu at Entity Tree
   *  @param {Function} fn
   */
  addEntityTreeContextMenuItemsResolver (fn) {
    configuration.entityTreeContextMenuItemsResolvers.push(fn)
  }

  /**
   * Add React component which will be used as tab title
   *
   * @param {String} key used in openTab
   * @param {ReactComponent|Function} component
   */
  addTabTitleComponent (key, component) {
    configuration.tabTitleComponents[key] = component
  }

  /**
   * Add component used in tab as content editor
   *
   * @param {String} key - key used in openTab({ editorComponentKey: ... , use entity set name if the editor should represent the main entity editor
   * @param {ReactComponent|Function} component
   * @param {Function} reformat - function handling reformatting code
   */
  addEditorComponent (key, component, reformat) {
    configuration.editorComponents[key] = component
    configuration.editorComponents[key].reformat = reformat
  }

  /**
   * Add component used in the left Properties section
   *
   * @param {Function|String} string or title function used to render the section title
   * @param {ReactComponent|Function} component
   * @param {Function} shouldDisplay
   */
  addPropertiesComponent (title, component, shouldDisplay) {
    configuration.propertiesComponents.push({
      title: title,
      component: component,
      shouldDisplay: shouldDisplay
    })
  }

  /**
   * Add component used in the MainPreview section
   * @param {String} type name of the new type of content that is going to display in MainPreview
   * @param {ReactComponent} component the component that is responsible of rendering the new type of content
   * @param {Object} opts options related to the presence of elements in the MainPreview title bar (tabs, actions, defaultActiveTab)
   */
  addPreviewComponent (type, component, opts = {}) {
    configuration.previewComponents[type] = {
      ...opts,
      component
    }
  }

  /**
   * Array of functions used to resolve ace editor mode for template content. This is used by custom templating engines
   * to add highlighting support for jade,ejs...
   *
   * @returns {Function[]}
   */
  get templateEditorModeResolvers () {
    return configuration.templateEditorModeResolvers
  }

  /**
   * Array of functions used to resolve entity icon in entity tree, function accepts entity and returns string like fa-cog
   *
   * @returns {Function[]}
   */
  get entityTreeIconResolvers () {
    return configuration.entityTreeIconResolvers
  }

  /**
   * Array of functions used to resolve filtering in entity tree,
   * function accepts entity, entitySets and filter info, should return boolean to determine if
   * item should be skipped or not
   *
   * @returns {Function[]}
   */
  get entityTreeFilterItemResolvers () {
    return configuration.entityTreeFilterItemResolvers
  }

  /**
   * Array of functions used to resolve drop into entity tree
   *
   * @returns {Function[]}
   */
  get entityTreeDropResolvers () {
    return configuration.entityTreeDropResolvers
  }

  /**
   * Array of functions used to resolve entity editor component editor, function accepts entity and returns string represent the component editor key
   *
   * @returns {Function[]}
   */
  get entityEditorComponentKeyResolvers () {
    return configuration.entityEditorComponentKeyResolvers
  }

  /**
   * Sets the function returning the browser url path
   * (defaultCalculatedPath, currentEntity) => String
   * @param {Function} fn
   */
  // eslint-disable-next-line accessor-pairs
  set locationResolver (fn) {
    // eslint-disable-next-line no-import-assign
    configuration.locationResolver = fn
  }

  /**
   * Set the function retunring the visibility flag for particular toolbar button
   * ('Save All') => return true
   * @param {Function} fn
   */
  // eslint-disable-next-line accessor-pairs
  set toolbarVisibilityResolver (fn) {
    // eslint-disable-next-line no-import-assign
    configuration.toolbarVisibilityResolver = fn
  }

  /**
   * Override the default entities references loading with custom function
   * (entitySet) => Promise([array])
   * @param {Function} fn
   */
  // eslint-disable-next-line accessor-pairs
  set referencesLoader (fn) {
    // eslint-disable-next-line no-import-assign
    configuration.referencesLoader = fn
  }

  /**
   * Optionally you can avoid displaying default startup page
   * @param {Boolean} trueOrFalse
   */
  // eslint-disable-next-line accessor-pairs
  set shouldOpenStartupPage (trueOrFalse) {
    // eslint-disable-next-line no-import-assign
    configuration.shouldOpenStartupPage = trueOrFalse
  }

  /**
   * Override the default entity remove behavior
   * (id) => {})
   * @param {Function} fn
   */
  // eslint-disable-next-line accessor-pairs
  set removeHandler (fn) {
    // eslint-disable-next-line no-import-assign
    configuration.removeHandler = fn
  }

  /**
   * Set additional custom header to all api calls
   * @param {String} key
   * @param {String} value
   */
  setRequestHeader (key, value) {
    configuration.apiHeaders[key] = value
  }

  setAboutModal (AboutModalComponent) {
    // eslint-disable-next-line no-import-assign
    configuration.aboutModal = AboutModalComponent
  }

  /** /initial configuration **/

  /** runtime helpers **/

  /**
   * Render new content/data inside the MainPreview of studio
   * @param {Object} params metadata about the preview
   */
  preview (params) {
    return storeMethods.preview(params)
  }

  /**
   * Updates the content/data inside the MainPreview of studio
   * @param {String} id Preview id of the content to update
   * @param {Object} params new metadata about the preview to update
   */
  updatePreview (id, params) {
    return storeMethods.updatePreview(id, params)
  }

  /**
   * Cleans the content inside the MainPreview of studio
   */
  clearPreview () {
    return storeMethods.clearPreview()
  }

  /**
   * Provides methods get,patch,post,del for accessing jsreport server
   *
   * @example
   * await Studio.api.patch('/odata/tasks', { data: { foo: '1' } })
   *
   * @returns {*}
   */
  get api () {
    return this.API
  }

  /**
   * Get registered entity sets, each one is object { visibleName: 'foo' }
   * @returns {Object[]}
   */
  get entitySets () {
    return configuration.entitySets
  }

  /**
   * Object[name] with registered extensions and its options
   * @returns {Object}
   */
  get extensions () {
    return configuration.extensions
  }

  /**
   * Opens modal dialog.
   *
   * @param {ReactComponent|String}componentOrText
   * @param {Object} options passed as props to the react component
   */
  openModal (componentOrText, options) {
    openModal(componentOrText, options || {})
  }

  openNewModal (entitySet) {
    openModal(NewEntityModal, { entitySet: entitySet })
  }

  isModalOpen () {
    return isModalOpen()
  }

  /**
   * Invokes run template preview process, when no template is passed it is invoked
   * for the last active template
   */
  run (params = {}, opts = {}) {
    return this.store.dispatch(editor.actions.run(params, opts))
  }

  /**
   * Collapse entity in EntityTree
   */
  collapseEntity (entityIdOrShortid, state = true, options = {}) {
    configuration.collapseEntityHandler(entityIdOrShortid, state, options)
  }

  /**
   * Collapse left pane
   */
  collapseLeftPane (type = true) {
    configuration.collapseLeftHandler(type)
  }

  /**
   * Collapse preview pane
   */
  collapsePreviewPane (type = true) {
    configuration.collapsePreviewHandler(type)
  }

  /**
   * Open and activate new editor tab
   *
   * @example
   * //open entity editor
   * Studio.openTab({ _id: 'myentityid' })
   * //open custom page
   * Studio.openTab({ key: 'StartupPage', editorComponentKey: 'startup', title: 'Statup' })
   *
   * @param {Object} tab
   */
  openTab (tab) {
    return this.store.dispatch(editor.actions.openTab(tab))
  }

  /**
   * Loads entity, which reference is already present in the ui state, from the remote API
   *
   * @param {String} id
   * @param {Boolean} force
   * @return {Promise}
   */
  loadEntity (id, force = false) {
    return this.store.dispatch(entities.actions.load(id, force))
  }

  /**
   * Remove the additional entity properties from the state, keep just meta and id
   * @param {String} id
   */
  unloadEntity (id) {
    return this.store.dispatch(entities.actions.unload(id))
  }

  /**
   * Add entity to the state
   * @param {Object} entity
   */
  addEntity (entity) {
    this.store.dispatch(entities.actions.add(entity))
  }

  /**
   * Update entity in the state
   * @param {Object} entity
   */
  updateEntity (entity) {
    this.store.dispatch(entities.actions.update(entity))
  }

  /**
   * Call remote API and persist (insert or update) entity
   * @param {String} id
   * @return {Promise}
   */
  saveEntity (id, opts) {
    return this.store.dispatch(entities.actions.save(id, opts))
  }

  /**
   * Adds already existing (persisted) entity into the UI state
   * @param entity
   */
  addExistingEntity (entity) {
    this.store.dispatch(entities.actions.addExisting(entity))
  }

  /**
   * Replace the existing entity in the state
   * @param {String} oldId
   * @param {Object} entity
   */
  replaceEntity (oldId, entity) {
    this.store.dispatch(entities.actions.replace(oldId, entity))
  }

  /**
   * Remove entity from the state
   * @param {String} id
   */
  removeEntity (id) {
    this.store.dispatch({
      type: entities.ActionTypes.REMOVE,
      _id: id
    })
  }

  /**
   * Show ui signalization for running background operation
   */
  startProgress () {
    this.store.dispatch(progress.actions.start())
  }

  /**
   * Hide ui signalization for running background operation
   */
  stopProgress () {
    this.store.dispatch(progress.actions.stop())
  }

  /**
   * Emits an error that shows the message in a modal
   * @param {Error} e
   * @param {Boolean} ignoreModal defaults to false
   */
  apiFailed (...args) {
    return this.store.dispatch(entities.actions.apiFailed(...args))
  }

  /**
   * Synchronize the location with history
   */
  updateHistory () {
    this.store.dispatch(editor.actions.updateHistory())
  }

  /**
   * Clear the current state and reload internally studio
   */
  async reset () {
    await this.store.dispatch({ type: 'RESET' })
    await this.store.dispatch(editor.actions.updateHistory())
    await this.store.dispatch(settings.actions.load())
    await bluebird.all(Object.keys(this.entitySets).map((t) => this.store.dispatch(entities.actions.loadReferences(t))))
  }

  /**
   * Get the current theme (it will check localstorage for user preference and fallback to the default theme configured)
   * @returns {Object[]}
   */
  getCurrentTheme () {
    return getCurrentTheme()
  }

  setCurrentTheme (themeInfo, opts) {
    return setCurrentTheme(themeInfo, opts)
  }

  /**
   * Get all settings from state
   * @returns {Object[]}
   */
  getSettings () {
    return settings.selectors.getAll(this.store.getState().settings)
  }

  /**
   * Save one setting in state and persist it on the server
   * @param {String} key
   * @param {Object} value
   */
  setSetting (key, value) {
    return this.store.dispatch(settings.actions.update(key, value))
  }

  /**
   * Get one setting value from the state
   * @param {String} key
   * @param {Boolean} shouldThrow
   */
  getSettingValueByKey (key, shouldThrow = true) {
    return settings.selectors.getValueByKey(this.store.getState().settings, key, shouldThrow)
  }

  /**
   * Searches for the entity in the UI state based on specified _id
   * @param {String} _id
   * @param {Boolean} shouldThrow
   * @returns {Object|null}
   */
  getEntityById (_id, shouldThrow = true) {
    return storeMethods.getEntityById(_id, shouldThrow)
  }

  /**
   * Searches for the entity in the UI state based on specified shortid
   * @param {String} shortid
   * @param {Boolean} shouldThrow
   * @returns {Object|null}
   */
  getEntityByShortid (shortid, shouldThrow = true) {
    return storeMethods.getEntityByShortid(shortid, shouldThrow)
  }

  /**
   * Returns the currently selected entity or null
   * @returns {Object}
   */
  getActiveEntity () {
    return editor.selectors.getActiveEntity(this.store.getState().activeTabKey, this.store.getState().editor.tabs, this.store.getState().entities)
  }

  /**
   * Returns last active entity
   * @returns {Object|null}
   */
  getLastActiveTemplate () {
    return editor.selectors.getLastActiveTemplate(this.store.getState().editor.lastActiveTemplateKey, this.store.getState().entities)
  }

  /**
   * Get all entities including meta attributes in array
   * @returns {Object[]}
   */
  getAllEntities () {
    return entities.selectors.getAll(this.store.getState().entities)
  }

  /**
   * If exists get a text editor instance of an opened text editor by name
   * @returns {Object|null}
   */
  getTextEditor (name) {
    return findTextEditor(name)
  }

  /**
   * Get references to entities
   * @returns {Object[]}
   */
  getReferences () {
    return entities.selectors.getReferences(this.store.getState().entities)
  }

  /**
   * Get the path in absolute form like /api/images and make it working also for jsreport running on subpath like myserver.com/reporting/api/images
   * @param {String} path
   * @returns {String}
   */
  resolveUrl (path) {
    return resolveUrl(path)
  }

  /**
   * Assemble entity absolute path
   * @param {*} entity
   * @returns {String}
   */
  resolveEntityPath (entity) {
    return storeMethods.resolveEntityPath(entity)
  }

  relativizeUrl (path) {
    console.trace('relativizeUrl is deprecated, use resolveUrl')
    return resolveUrl(path)
  }

  /**
   * absolute root url to the server, like http://localhost/reporting
   * @returns {string}
   */
  get rootUrl () {
    return rootUrl()
  }

  /** /runtime helpers **/

  /** react components **/

  /**
   * Ace editor React wrapper
   *
   * @example
   * export default class DataEditor extends TextEditor { ... }
   *
   * @returns {TextEditor}
   */
  get TextEditor () {
    return TextEditor
  }

  /**
   * Component used to split content with sliders
   *
   * @returns {SplitPane}
   */
  get SplitPane () {
    return SplitPane
  }

  /**
   * Component used to show content in a popover
   *
   * @returns {Popover}
   */
  get Popover () {
    return Popover
  }

  /**
   * Component used to show content in a popup
   *
   * @returns {Popup}
   */
  get Popup () {
    return Popup
  }

  /**
   * Component used to visualise entities
   *
   * @returns {EntityTree}
   */
  get EntityTree () {
    return EntityTree
  }

  /**
   * Component used to add actions in EntityTree toolbar
   * @returns {EntityTreeButton}
   */
  get EntityTreeButton () {
    return EntityTreeButton
  }

  /**
   * Component used for multi-select options
   * @returns {MultiSelect}
   */
  get MultiSelect () {
    return MultiSelect
  }

  /**
   * Component used for file upload
   * @returns {MultiSelect}
   */
  get FileInput () {
    return FileInput
  }

  /**
   * Component used to select entity refs
   * @returns {EntityRefSelect}
   */
  get EntityRefSelect () {
    return EntityRefSelect
  }

  get Preview () {
    return Preview
  }

  get FramePreview () {
    return FramePreview
  }

  get dragAndDropNativeTypes () {
    return NativeTypes
  }

  constructor (store) {
    this.editor = editor
    this.store = store
    this.entities = entities
    this.settings = settings
    this.references = {}
    // extensions can add routes, not yet prototyped
    this.routes = []

    this.API = {}
    methods.forEach((m) => {
      this.API[m] = (...args) => {
        this.startProgress()
        return api[m](...args).then((v) => {
          this.stopProgress()
          return v
        }).catch((e) => {
          this.stopProgress()

          this.store.dispatch(this.entities.actions.apiFailed(e, args[2] === true))

          throw e
        })
      }
    })

    // webpack replaces all the babel runtime references in extensions with externals taking runtime from this field
    // this basically removes the duplicated babel runtime code from extensions and decrease its sizes
    this.runtime = babelRuntime

    // the same case as for babel runtime, we expose the following libraries and replace their references in extensions
    // using webpack externals
    this.libraries = {
      react: React,
      'react-dom': ReactDom,
      'prop-types': PropTypes,
      'react-list': ReactList,
      superagent: superagent,
      shortid: shortid,
      bluebird: bluebird,
      'filesaver.js-npm': fileSaver,
      'socket.io-client': io
    }
  }
}

let studio
export const createStudio = (store) => (studio = new Studio(store))

export default studio
