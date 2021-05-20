import Promise from 'bluebird'
import PropTypes from 'prop-types'
import React, { Component } from 'react'
import { connect } from 'react-redux'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import * as editor from '../../redux/editor'
import * as entities from '../../redux/entities'
import * as progress from '../../redux/progress'
import storeMethods from '../../redux/methods'
import MainPreview from '../../components/Preview/MainPreview'
import EntityTreeBox from '../../components/EntityTree/EntityTreeBox'
import EntityTree from '../../components/EntityTree/EntityTree'
import Properties from '../../components/Properties/Properties'
import style from './App.css'
import Toolbar from '../../components/Toolbar/Toolbar'
import SplitPane from '../../components/common/SplitPane/SplitPane'
import EditorTabs from '../../components/Tabs/EditorTabs'
import TabTitles from '../../components/Tabs/TabTitles'
import Modal from '../Modal/Modal'
import NewFolderModal from '../../components/Modals/NewFolderModal'
import NewEntityModal from '../../components/Modals/NewEntityModal'
import DeleteConfirmationModal from '../../components/Modals/DeleteConfirmationModal'
import CloseConfirmationModal from '../../components/Modals/CloseConfirmationModal'
import RenameModal from '../../components/Modals/RenameModal'
import RestoreDockConfirmationModal from '../../components/Modals/RestoreDockConfirmationModal'
import getCloneName from '../../../shared/getCloneName'
import { previewWindows, getPreviewWindowOptions } from '../../helpers/previewWindow'
import {
  extensions,
  removeHandler,
  entitySets,
  shouldOpenStartupPage,
  registerCollapseLeftHandler,
  registerCollapsePreviewHandler,
  collapseEntityHandler,
  entityTreeWrapperComponents
} from '../../lib/configuration'

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
    this.handleRun = this.handleRun.bind(this)
    this.handlePreviewCollapsing = this.handlePreviewCollapsing.bind(this)
    this.handlePreviewDocking = this.handlePreviewDocking.bind(this)
    this.handlePreviewUndocking = this.handlePreviewUndocking.bind(this)
    this.handlePreviewUndocked = this.handlePreviewUndocked.bind(this)
    this.isPreviewUndockeable = this.isPreviewUndockeable.bind(this)
  }

  componentDidMount () {
    window.onbeforeunload = () => {
      if (this.props.canSaveAll) {
        return 'You may have unsaved changes'
      }
    }

    registerCollapseLeftHandler((type = true) => {
      this.leftPaneRef.current.collapse(type)
    })

    registerCollapsePreviewHandler((type = true) => {
      this.previewPaneRef.current.collapse(type)
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

  async handleRun (profiling = true) {
    this.props.progressStart()

    try {
      await this.props.run({}, { profiling })
    } finally {
      this.props.progressStop()
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

  openStartup () {
    if (!extensions.studio.options.startupPage) {
      return
    }

    if (shouldOpenStartupPage) {
      this.props.openTab({
        key: 'StartupPage',
        editorComponentKey: 'startup',
        title: 'Startup'
      })
    }
  }

  closeTab (key) {
    const entity = storeMethods.getEntityById(key, false)

    if (!entity || !entity.__isDirty) {
      return this.props.closeTab(key)
    }
    this.openModal(CloseConfirmationModal, { _id: key })
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

  handlePreviewUndocked () {
    this.handleRun()
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
      entities,
      activateTab,
      activeTabKey,
      activeTab,
      activeEntity,
      update,
      groupedUpdate
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
                  this.handleRun(profiling)
                }}
                openStartup={() => this.openStartup()}
              />
              <div className='block'>
                <SplitPane
                  ref={this.leftPaneRef}
                  primary='second'
                  collapsedText='Objects / Properties'
                  collapsable='first'
                  resizerClassName='resizer'
                  defaultSize='85%'
                >
                  <SplitPane
                    primary='second'
                    resizerClassName='resizer-horizontal'
                    split='horizontal'
                    defaultSize={(window.innerHeight * 0.5) + 'px'}
                  >
                    <EntityTreeBox>
                      {this.renderEntityTree()}
                    </EntityTreeBox>
                    <Properties entity={activeEntity} entities={entities} onChange={updateBasedOnActiveTab} />
                  </SplitPane>

                  <div className='block'>
                    <TabTitles
                      activeTabKey={activeTabKey}
                      activateTab={activateTab}
                      tabs={tabsWithEntities}
                      closeTab={(k) => this.closeTab(k)}
                    />
                    <SplitPane
                      ref={this.previewPaneRef}
                      primary='second'
                      collapsedText='preview'
                      collapsable='second'
                      undockeable={this.isPreviewUndockeable}
                      onCollapsing={this.handlePreviewCollapsing}
                      onDocking={this.handlePreviewDocking}
                      onUndocking={this.handlePreviewUndocking}
                      onUndocked={this.handlePreviewUndocked}
                      resizerClassName='resizer'
                    >
                      <EditorTabs
                        activeTabKey={activeTabKey}
                        onUpdate={(v) => groupedUpdateBasedOnActiveTab(v)}
                        tabs={tabsWithEntities}
                      />
                      <MainPreview />
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

export default connect((state) => {
  return {
    entities: state.entities,
    undockMode: state.editor.undockMode,
    references: entities.selectors.getReferences(state),
    activeTabKey: state.editor.activeTabKey,
    activeTabWithEntity: editor.selectors.getActiveTabWithEntity(state),
    isPending: progress.selectors.getIsPending(state),
    canRun: editor.selectors.canRun(state),
    canSave: editor.selectors.canSave(state),
    canSaveAll: editor.selectors.canSaveAll(state),
    tabsWithEntities: editor.selectors.getTabWithEntities(state),
    activeTab: editor.selectors.getActiveTab(state),
    activeEntity: editor.selectors.getActiveEntity(state),
    lastActiveTemplate: editor.selectors.getLastActiveTemplate(state)
  }
}, {
  ...editor.actions,
  progressStart: progress.actions.start,
  progressStop: progress.actions.stop
})(App)
