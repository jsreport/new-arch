import Promise from 'bluebird'
import PropTypes from 'prop-types'
import React, { Component } from 'react'
import { connect } from 'react-redux'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import fileSaver from 'filesaver.js-npm'
import cookies from 'js-cookie'
import { actions, selectors } from '../../redux/editor'
import * as entities from '../../redux/entities'
import Preview from '../../components/Preview/Preview.js'
import EntityTreeBox from '../../components/EntityTree/EntityTreeBox.js'
import EntityTree from '../../components/EntityTree/EntityTree.js'
import Properties from '../../components/Properties/Properties.js'
import style from './App.css'
import Toolbar from '../../components/Toolbar/Toolbar.js'
import SplitPane from '../../components/common/SplitPane/SplitPane.js'
import EditorTabs from '../../components/Tabs/EditorTabs.js'
import TabTitles from '../../components/Tabs/TabTitles.js'
import Modal from '../Modal/Modal.js'
import NewFolderModal from '../../components/Modals/NewFolderModal.js'
import NewEntityModal from '../../components/Modals/NewEntityModal.js'
import DeleteConfirmationModal from '../../components/Modals/DeleteConfirmationModal.js'
import CloseConfirmationModal from '../../components/Modals/CloseConfirmationModal.js'
import RenameModal from '../../components/Modals/RenameModal.js'
import RestoreDockConfirmationModal from '../../components/Modals/RestoreDockConfirmationModal.js'
import * as progress from '../../redux/progress'
import getCloneName from '../../../shared/getCloneName'
import uid from '../../helpers/uid.js'
import { previewWindows, openPreviewWindow, getPreviewWindowOptions } from '../../helpers/previewWindow'
import {
  extensions,
  triggerSplitResize,
  removeHandler,
  previewListeners,
  registerGetPreviewTargetHandler,
  registerPreviewHandler,
  entitySets,
  shouldOpenStartupPage,
  registerCollapseLeftHandler,
  registerCollapsePreviewHandler,
  collapseEntityHandler,
  entityTreeWrapperComponents
} from '../../lib/configuration.js'

const progressActions = progress.actions

class App extends Component {
  static propTypes = {
    entities: PropTypes.object,
    references: PropTypes.object,
    tabsWithEntities: PropTypes.array,
    currentDetail: PropTypes.object,
    error: PropTypes.string,
    loading: PropTypes.bool,
    loaded: PropTypes.bool
  };

  constructor (props) {
    super(props)

    this.leftPaneRef = React.createRef()
    this.previewPaneRef = React.createRef()
    this.previewRef = React.createRef()

    this.openModal = this.openModal.bind(this)
    this.createPreviewTarget = this.createPreviewTarget.bind(this)
    this.handlePreviewCollapsing = this.handlePreviewCollapsing.bind(this)
    this.handlePreviewDocking = this.handlePreviewDocking.bind(this)
    this.handlePreviewUndocking = this.handlePreviewUndocking.bind(this)
    this.handlePreviewUndocked = this.handlePreviewUndocked.bind(this)
    this.handlePreviewCollapseChange = this.handlePreviewCollapseChange.bind(this)
    this.isPreviewUndockeable = this.isPreviewUndockeable.bind(this)
  }

  componentDidMount () {
    window.onbeforeunload = () => {
      if (this.props.canSaveAll) {
        return 'You may have unsaved changes'
      }
    }

    registerGetPreviewTargetHandler(() => {
      let target = 'previewFrame'

      if (this.props.undockMode) {
        target = 'previewFrame_GENERAL'

        openPreviewWindow({
          id: target,
          name: target,
          tab: true
        })
      }

      return target
    })

    registerPreviewHandler((src) => {
      if (!src) {
        this.handleRun(
          this.createPreviewTarget(
            this.props.undockMode ? (
              `window-${getPreviewWindowOptions(this.props.lastActiveTemplate != null ? this.props.lastActiveTemplate.shortid : undefined).id}`
            ) : undefined
          )
        )
      }
    })

    registerCollapseLeftHandler((type = true) => {
      this.leftPaneRef.current.collapse(type)
    })

    registerCollapsePreviewHandler((type = true) => {
      this.previewPaneRef.current.collapse(type)
    })

    previewListeners.push((request, entities, target) => {
      const { lastActiveTemplate, undockMode } = this.props

      // we need to try to open the window again to get a reference to any existing window
      // created with the id, this is necessary because the window can be closed by the user
      // using the native close functionality of the browser tab,
      // if we don't try to open the window again we will have inconsistent references and
      // we can not close all preview tabs when un-collapsing the main pane preview again
      if (
        (undockMode || target.type.indexOf('window-') === 0) &&
        this.previewPaneRef.current &&
        target &&
        target.type &&
        target.type.indexOf(request.template.shortid) !== -1
      ) {
        let previewWinOpts = getPreviewWindowOptions(lastActiveTemplate != null ? lastActiveTemplate.shortid : undefined)
        openPreviewWindow(previewWinOpts)
      }
    })

    if (this.props.match.params.shortid) {
      const { shortid, entitySet } = this.props.match.params

      // delay the collapsing a bit to avoid showing ugly transition of collapsed -> uncollapsed
      setTimeout(() => {
        collapseEntityHandler({ shortid }, false, { parents: true, self: false })
      }, 200)

      this.props.openTab({ shortid, entitySet })
      return
    }

    this.openStartup()
  }

  componentDidUpdate () {
    this.props.updateHistory()
  }

  createPreviewTarget (type, profiling = true) {
    const normalizedType = type == null ? 'preview' : type
    const windowPrefix = 'window-'
    const isWindowType = normalizedType.indexOf(windowPrefix) === 0
    let processFile
    let focus

    const handleLog = (fileInfo) => {
      if (isWindowType || !profiling) {
        return
      }

      try {
        const log = JSON.parse(new TextDecoder().decode(fileInfo.rawData))
        this.previewRef.current.addProfilerLog(log)
      } catch (e) {
        console.warn(`Unable to parse profiler log. Error: ${e.message}`)
      }
    }

    const handleOperation = (fileInfo) => {
      if (isWindowType || !profiling) {
        return
      }

      try {
        const operation = JSON.parse(new TextDecoder().decode(fileInfo.rawData))
        this.previewRef.current.addProfilerOperation(operation)
      } catch (e) {
        console.warn(`Unable to parse profiler operation. Error: ${e.message}`)
      }
    }

    const handleError = (fileInfo) => {
      try {
        // we get here when there was an error during the render, usually the error
        // here is something general so it should show as part of the general error state
        const error = JSON.parse(new TextDecoder().decode(fileInfo.rawData))

        if (!isWindowType && profiling) {
          this.previewRef.current.addProfilerError(error)
        }

        return error
      } catch (e) {
        console.warn(`Unable to parse error. Error: ${e.message}`)
      }
    }

    if (normalizedType === 'preview' || normalizedType.indexOf(windowPrefix) === 0) {
      processFile = (fileInfo, previewId, previewName) => {
        if (fileInfo.name === 'report') {
          const file = new window.File([fileInfo.rawData.buffer], fileInfo.filename, {
            type: fileInfo.contentType
          })

          const newURLBlob = URL.createObjectURL(file)

          if (isWindowType) {
            const windowId = normalizedType.slice(windowPrefix.length)
            const windowRef = previewWindows[windowId]
            windowRef.location.href = newURLBlob
          } else {
            this.previewRef.current.changeSrc(newURLBlob, { id: previewId })
            this.previewRef.current.addReport(fileInfo)
          }
        } else if (fileInfo.name === 'log') {
          handleLog(fileInfo)
        } else if (fileInfo.name === 'operationStart' || fileInfo.name === 'operationEnd') {
          handleOperation(fileInfo)
        } else if (fileInfo.name === 'error') {
          const error = handleError(fileInfo)
          const newURLBlob = URL.createObjectURL(new Blob([`Report${previewName != null ? ` "${previewName}"` : ''} render failed.\n\n${error.message}\n${error.stack}`], { type: 'text/plain' }))

          if (isWindowType) {
            const windowId = normalizedType.slice(windowPrefix.length)
            const windowRef = previewWindows[windowId]
            windowRef.location.href = newURLBlob
          } else {
            this.previewRef.current.changeSrc(newURLBlob, { id: previewId })
          }
        }
      }

      focus = () => {
        if (isWindowType) {
          const windowId = normalizedType.slice(windowPrefix.length)
          const windowRef = previewWindows[windowId]
          windowRef.focus()
        }
      }
    }

    if (processFile == null) {
      throw new Error(`Preview target type "${normalizedType}" is not supported`)
    }

    return {
      type: normalizedType,
      previewType: profiling ? 'report-profiler' : 'report',
      processFile,
      focus
    }
  }

  async handleRun (target, profiling = true) {
    this.props.start()

    const previewId = uid()

    target.previewId = previewId

    const windowPrefix = 'window-'
    const isWindowType = target.type.indexOf(windowPrefix) === 0

    try {
      await this.props.run(target)
    } catch (error) {
      if (!isWindowType && profiling) {
        this.previewRef.current.addProfilerError({
          type: 'globalError',
          message: error.message,
          stack: error.stack
        })
      }

      const newURLBlob = URL.createObjectURL(new Blob([`${error.message}\n\n${error.stack}`], { type: 'text/plain' }))

      if (isWindowType) {
        const windowId = target.type.slice(windowPrefix.length)
        const windowRef = previewWindows[windowId]
        windowRef.location.href = newURLBlob
      } else {
        this.previewRef.current.changeSrc(newURLBlob, { id: previewId })
      }
    } finally {
      this.props.stop()
    }
  }

  openModal (componentOrText, options) {
    this.refOpenModal(componentOrText, options)
  }

  save () {
    return this.props.save()
  }

  saveAll () {
    return this.props.saveAll()
  }

  handleSplitChanged () {
    triggerSplitResize()

    Object.keys(Preview.instances).forEach((instanceId) => {
      const previewInstance = Preview.instances[instanceId]
      previewInstance.resizeStarted()
    })
  }

  openStartup () {
    if (!extensions.studio.options.startupPage) {
      return
    }

    if (shouldOpenStartupPage) {
      this.props.openTab({
        key: 'StartupPage',
        editorComponentKey: 'startup',
        title: 'Startup',
        getProps: () => ({
          addProfilerOperation: this.previewRef.current.addProfilerOperation,
          addProfilerLog: this.previewRef.current.addProfilerLog,
          addProfilerError: this.previewRef.current.addProfilerError
        })
      })
    }
  }

  closeTab (key) {
    const { getEntityById } = this.props
    const entity = getEntityById(key, false)

    if (!entity || !entity.__isDirty) {
      return this.props.closeTab(key)
    }
    this.openModal(CloseConfirmationModal, { _id: key })
  }

  handleSplitDragFinished () {
    Object.keys(Preview.instances).forEach((instanceId) => {
      const previewInstance = Preview.instances[instanceId]
      previewInstance.resizeEnded()
    })
  }

  isPreviewUndockeable () {
    const { activeTabWithEntity, undockMode } = this.props

    // if we are in undock mode the pane return true
    if (undockMode) {
      return true
    }

    return (
      activeTabWithEntity &&
      activeTabWithEntity.entity &&
      activeTabWithEntity.entity.__entitySet === 'templates'
    )
  }

  handlePreviewCollapsing (collapsed) {
    if (!this.props.undockMode) {
      return true
    }

    if (!collapsed) {
      return new Promise((resolve) => {
        this.openModal(RestoreDockConfirmationModal, {
          onResponse: (response) => resolve(response)
        })
      })
    }

    return true
  }

  handlePreviewCollapseChange () {
    triggerSplitResize()
  }

  handlePreviewDocking () {
    // close all preview windows when docking
    if (Object.keys(previewWindows).length) {
      Object.keys(previewWindows).forEach((id) => {
        if (previewWindows[id] != null) {
          previewWindows[id].close()
          delete previewWindows[id]
        }
      })
    }

    this.props.desactivateUndockMode()
  }

  handlePreviewUndocking () {
    const { lastActiveTemplate, activeTabWithEntity } = this.props

    if (
      activeTabWithEntity &&
      activeTabWithEntity.entity &&
      activeTabWithEntity.entity.__entitySet === 'templates'
    ) {
      this.props.activateUndockMode()

      return getPreviewWindowOptions(lastActiveTemplate != null ? lastActiveTemplate.shortid : undefined)
    }

    return false
  }

  handlePreviewUndocked (id, previewWindow) {
    previewWindows[id] = previewWindow
    this.handleRun(this.createPreviewTarget(`window-${id}`))
  }

  renderEntityTree () {
    const containerStyles = {
      display: 'flex',
      flex: 1,
      flexDirection: 'column',
      // firefox needs min-height and min-width explicitly declared to allow descendants flex items to be scrollable (overflow)
      minWidth: 0,
      minHeight: 0
    }

    const { activeEntity, references } = this.props

    const entityTreeProps = {
      main: true,
      toolbar: true,
      onRename: (id) => this.openModal(RenameModal, { _id: id }),
      onClone: (entity) => {
        let modalToOpen

        const options = {
          cloning: true,
          entity: entity,
          initialName: getCloneName(entity.name)
        }

        if (entity.__entitySet === 'folders') {
          modalToOpen = NewFolderModal
        } else {
          modalToOpen = NewEntityModal
          options.entitySet = entity.__entitySet
        }

        this.openModal(modalToOpen, options)
      },
      onRemove: (id, children) => removeHandler ? removeHandler(id, children) : this.openModal(DeleteConfirmationModal, { _id: id, childrenIds: children }),
      activeEntity,
      entities: references,
      onNewEntity: (es, options) => entitySets[es].onNew ? entitySets[es].onNew(options || {}) : this.openModal(NewEntityModal, { ...options, entitySet: es })
    }

    // if there are no components registered, defaults to rendering the EntityTree alone
    if (!entityTreeWrapperComponents.length) {
      return React.createElement(EntityTree, entityTreeProps)
    }

    // composing components
    const wrappedEntityTree = entityTreeWrapperComponents.reduce((prevElement, component) => {
      const propsToWrapper = {
        entities: references,
        entitySets: entitySets,
        containerStyles
      }

      if (prevElement == null) {
        return React.createElement(
          component,
          propsToWrapper,
          React.createElement(EntityTree, entityTreeProps)
        )
      }

      return React.createElement(
        component,
        propsToWrapper,
        prevElement
      )
    }, null)

    if (!wrappedEntityTree) {
      return null
    }

    return wrappedEntityTree
  }

  render () {
    const {
      tabsWithEntities,
      isPending,
      canRun,
      canSave,
      canSaveAll,
      activeTabWithEntity,
      lastActiveTemplate,
      entities,
      stop,
      activateTab,
      activeTabKey,
      activeTab,
      activeEntity,
      update,
      groupedUpdate,
      undockMode
    } = this.props

    const updateBasedOnActiveTab = (...params) => {
      if (activeTab && activeTab.readOnly) {
        return
      }

      return update(...params)
    }

    const groupedUpdateBasedOnActiveTab = (...params) => {
      if (activeTab && activeTab.readOnly) {
        return
      }

      return groupedUpdate(...params)
    }

    return (
      <DndProvider backend={HTML5Backend}>
        <div className='container'>
          <Modal openCallback={(open) => { this.refOpenModal = open }} />

          <div className={style.appContent + ' container'}>
            <div className='block'>
              <Toolbar
                canRun={canRun}
                canSave={canSave}
                canSaveAll={canSaveAll}
                onSave={() => this.save()}
                onSaveAll={() => this.saveAll()}
                isPending={isPending}
                activeTab={activeTabWithEntity}
                onUpdate={updateBasedOnActiveTab}
                onRun={(profiling = true) => {
                  this.handleRun(
                    this.createPreviewTarget(undockMode ? (
                      `window-${getPreviewWindowOptions(lastActiveTemplate != null ? lastActiveTemplate.shortid : undefined).id}`
                    ) : undefined, profiling),
                    profiling
                  )
                }}
                openStartup={() => this.openStartup()}
              />

              <div className='block'>
                <SplitPane
                  ref={this.leftPaneRef}
                  collapsedText='Objects / Properties' collapsable='first'
                  resizerClassName='resizer' defaultSize='85%' onChange={() => this.handleSplitChanged()}
                  onDragFinished={() => this.handleSplitDragFinished()}>
                  <SplitPane
                    resizerClassName='resizer-horizontal' split='horizontal'
                    defaultSize={(window.innerHeight * 0.5) + 'px'}>
                    <EntityTreeBox>
                      {this.renderEntityTree()}
                    </EntityTreeBox>
                    <Properties entity={activeEntity} entities={entities} onChange={updateBasedOnActiveTab} />
                  </SplitPane>

                  <div className='block'>
                    <TabTitles
                      activeTabKey={activeTabKey} activateTab={activateTab} tabs={tabsWithEntities}
                      closeTab={(k) => this.closeTab(k)} />
                    <SplitPane
                      ref={this.previewPaneRef}
                      collapsedText='preview'
                      collapsable='second'
                      undockeable={this.isPreviewUndockeable}
                      onChange={() => this.handleSplitChanged()}
                      onCollapsing={this.handlePreviewCollapsing}
                      onCollapseChange={this.handlePreviewCollapseChange}
                      onDocking={this.handlePreviewDocking}
                      onUndocking={this.handlePreviewUndocking}
                      onUndocked={this.handlePreviewUndocked}
                      onDragFinished={() => this.handleSplitDragFinished()}
                      resizerClassName='resizer'>
                      <EditorTabs
                        activeTabKey={activeTabKey}
                        onUpdate={(v) => groupedUpdateBasedOnActiveTab(v)}
                        tabs={tabsWithEntities}
                      />
                      <Preview ref={this.previewRef} main />
                    </SplitPane>
                  </div>
                </SplitPane>
              </div>
            </div>
          </div>
        </div>
      </DndProvider>
    )
  }
}

export default connect((state) => ({
  entities: state.entities,
  references: entities.selectors.getReferences(state),
  activeTabKey: state.editor.activeTabKey,
  activeTabWithEntity: selectors.getActiveTabWithEntity(state),
  isPending: progress.selectors.getIsPending(state),
  canRun: selectors.canRun(state),
  canSave: selectors.canSave(state),
  canSaveAll: selectors.canSaveAll(state),
  tabsWithEntities: selectors.getTabWithEntities(state),
  activeTab: selectors.getActiveTab(state),
  activeEntity: selectors.getActiveEntity(state),
  lastActiveTemplate: selectors.getLastActiveTemplate(state),
  undockMode: state.editor.undockMode,
  getEntityById: (id, ...params) => entities.selectors.getById(state, id, ...params),
  getEntityByShortid: (shortid, ...params) => entities.selectors.getByShortid(state, shortid, ...params)
}), { ...actions, ...progressActions })(App)
