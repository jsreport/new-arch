import Promise from 'bluebird'
import React, { Component } from 'react'
import { connect } from 'react-redux'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import MainPreview from '../../components/Preview/MainPreview'
import EntityTreeBox from '../../components/EntityTree/EntityTreeBox'
import Properties from '../../components/Properties/Properties'
import style from './App.css'
import Toolbar from '../../components/Toolbar/Toolbar'
import SplitPane from '../../components/common/SplitPane/SplitPane'
import EditorTabs from '../../components/Tabs/EditorTabs'
import TabTitles from '../../components/Tabs/TabTitles'
import { openTab, desactivateUndockMode } from '../../redux/editor/actions'
import storeMethods from '../../redux/methods'
import Modal from '../Modal/Modal'
import RestoreDockConfirmationModal from '../../components/Modals/RestoreDockConfirmationModal'
import { openModal } from '../../helpers/openModal'
import openStartup from '../../helpers/openStartup'
import runLastActiveTemplate from '../../helpers/runLastActiveTemplate'
import { openPreviewWindow, previewWindows, getPreviewWindowOptions } from '../../helpers/previewWindow'

import {
  registerCollapseLeftHandler,
  registerCollapsePreviewHandler,
  collapseEntityHandler
} from '../../lib/configuration'

class App extends Component {
  constructor (props) {
    super(props)

    this.leftPaneRef = React.createRef()
    this.previewPaneRef = React.createRef()

    this.isPreviewUndockeable = this.isPreviewUndockeable.bind(this)
    this.handlePreviewCollapsing = this.handlePreviewCollapsing.bind(this)
    this.handlePreviewBeforeCollapseChange = this.handlePreviewBeforeCollapseChange.bind(this)
    this.handlePreviewCollapseChange = this.handlePreviewCollapseChange.bind(this)
    this.renderCollapsedIcon = this.renderCollapsedIcon.bind(this)
  }

  componentDidMount () {
    window.onbeforeunload = () => {
      const canSaveAll = storeMethods.getEditorCanSaveAll()

      if (canSaveAll) {
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

    openStartup()
  }

  isPreviewUndockeable () {
    const undockMode = storeMethods.getEditorUndockMode()
    const activeTabWithEntity = storeMethods.getEditorActiveTabWithEntity()

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
    const undockMode = storeMethods.getEditorUndockMode()

    if (!undockMode) {
      return true
    }

    if (!collapsed) {
      return new Promise((resolve) => {
        openModal(RestoreDockConfirmationModal, {
          onResponse: (response) => resolve(response)
        })
      })
    }

    return true
  }

  handlePreviewBeforeCollapseChange (collapsed) {
    const isUndockeable = this.isPreviewUndockeable()
    const undockMode = storeMethods.getEditorUndockMode()

    if (isUndockeable && undockMode && !collapsed) {
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
  }

  handlePreviewCollapseChange (collapsed) {
    const isUndockeable = this.isPreviewUndockeable()
    const undockMode = storeMethods.getEditorUndockMode()

    if (isUndockeable && undockMode && collapsed) {
      const lastActiveTemplate = storeMethods.getEditorLastActiveTemplate()
      const windowOpts = getPreviewWindowOptions(lastActiveTemplate != null ? lastActiveTemplate.shortid : undefined)

      if (!windowOpts) {
        return
      }

      // opening the window when setState is done..
      // giving it the chance to clear the previous iframe
      openPreviewWindow(windowOpts)
      runLastActiveTemplate()
    }
  }

  renderCollapsedIcon () {
    const isUndockeable = this.isPreviewUndockeable()
    const undockMode = storeMethods.getEditorUndockMode()

    if (!isUndockeable || !undockMode) {
      return null
    }

    return (
      <span>
        <i className='fa fa-window-maximize' />
        {' '}
      </span>
    )
  }

  render () {
    return (
      <DndProvider backend={HTML5Backend}>
        <div className='container'>
          <Modal />
          <div className={style.appContent + ' container'}>
            <div className='block'>
              <Toolbar />
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
                    <EntityTreeBox />
                    <Properties />
                  </SplitPane>
                  <div className='block'>
                    <TabTitles />
                    <SplitPane
                      ref={this.previewPaneRef}
                      primary='second'
                      collapsedText='preview'
                      renderCollapsedIcon={this.renderCollapsedIcon}
                      collapsable='second'
                      onCollapsing={this.handlePreviewCollapsing}
                      onBeforeCollapseChange={this.handlePreviewBeforeCollapseChange}
                      onCollapseChange={this.handlePreviewCollapseChange}
                      resizerClassName='resizer'
                    >
                      <EditorTabs />
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

export default connect(undefined, {
  openTab,
  desactivateUndockMode
})(App)
