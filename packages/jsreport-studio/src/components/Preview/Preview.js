import PropTypes from 'prop-types'
import React, { Fragment, Component } from 'react'
import { connect } from 'react-redux'
import classNames from 'classnames'
import shortid from 'shortid'
import fileSaver from 'filesaver.js-npm'
import FileInput from '../common/FileInput/FileInput'
import PreviewActionsMenu from './PreviewActionsMenu'
import PreviewDisplay from './PreviewDisplay'
import ProfilerContent from './ProfilerContent'
import ProfilerInspectModal from '../Modals/ProfilerInspectModal'
import ProfilerErrorModal from '../Modals/ProfilerErrorModal'
import { selectors as entitiesSelectors } from '../../redux/entities'
import { selectors as editorSelectors, actions as editorActions } from '../../redux/editor'
import parseProfile from '../../helpers/parseProfile'
import getStateAtOperation from '../../helpers/getStateAtProfilerOperation'
import resolveUrl from '../../helpers/resolveUrl'
import uid from '../../helpers/uid'
import { findTextEditor, selectLine as selectLineInTextEditor } from '../../helpers/textEditorInstance'
import {
  modalHandler,
  subscribeToThemeChange,
  registerPreviewFrameChangeHandler,
  registerPreviewConfigurationHandler,
  previewFrameChangeHandler,
  previewConfigurationHandler
} from '../../lib/configuration.js'
import styles from './Preview.css'

class Preview extends Component {
  static instances = {}

  static propTypes = {
    onLoad: PropTypes.func
  }

  constructor (props) {
    super(props)

    this.previewDisplayContainerRef = React.createRef()
    this.previewDisplayOverlayRef = React.createRef()
    this.previewDisplayIframeRef = React.createRef()
    this.actionsMenuTriggerRef = React.createRef()
    this.actionsMenuContainerRef = React.createRef()
    this.uploadProfileInputRef = React.createRef()

    this.state = {
      previewDisplayIframeKey: shortid.generate(),
      src: this.props.initialSrc,
      previewId: null,
      previewTemplate: null,
      previewType: 'normal',
      previewReportFile: null,
      disableTheming: false,
      activePreviewTab: 'profiler',
      expandedActionsMenu: false,
      profilerOperations: [],
      profilerLogs: [],
      profilerActiveElement: null,
      profilerErrors: { global: null, general: null, operations: {} }
    }

    this.handleOnPreviewDisplayLoad = this.handleOnPreviewDisplayLoad.bind(this)
    this.handleOnProfilerCanvasClick = this.handleOnProfilerCanvasClick.bind(this)
    this.handleOnProfilerElementClick = this.handleOnProfilerElementClick.bind(this)
    this.handleOnActionMenuClick = this.handleOnActionMenuClick.bind(this)
    this.applyStylesToIframe = this.applyStylesToIframe.bind(this)
    this.addProfilerOperation = this.addProfilerOperation.bind(this)
    this.addProfilerLog = this.addProfilerLog.bind(this)
    this.addProfilerError = this.addProfilerError.bind(this)
    this.changeSrc = this.changeSrc.bind(this)
    this.changeActiveTab = this.changeActiveTab.bind(this)
    this.clear = this.clear.bind(this)
  }

  componentDidMount () {
    this.instanceId = shortid.generate()
    Preview.instances[this.instanceId] = this

    if (this.props.main) {
      this.disposePreviewChangeHandler = registerPreviewFrameChangeHandler((src, opts = {}) => {
        let srcToUse = src
        const dataURLMatch = /^data:([^,;]+)?(;[^,]+)?(,.+)/.exec(src)

        if (dataURLMatch != null) {
          const blob = new Blob([decodeURI(dataURLMatch[3].slice(1))], { type: dataURLMatch[1] })
          srcToUse = window.URL.createObjectURL(blob)
        }

        previewConfigurationHandler({ ...opts, src: srcToUse })
      })

      this.disposePreviewConfigurationHandler = registerPreviewConfigurationHandler(async (opts = {}) => {
        const newState = {}

        if (opts.src == null) {
          newState.src = null
        } else {
          newState.src = opts.src
        }

        if (opts.id !== this.state.previewId) {
          newState.previewId = opts.id
          newState.previewTemplate = opts.template
          newState.previewType = opts.type
          newState.previewReportFile = null
          newState.profilerOperations = []
          newState.profilerLogs = []
          newState.profilerActiveElement = null

          if (opts.type === 'report') {
            newState.activePreviewTab = 'report'
          }

          newState.profilerErrors = { global: null, general: null, operations: {} }
        }

        if (
          opts.disableTheming === true ||
          (newState.src != null && this.state.src == null && this.state.disableTheming === true)
        ) {
          newState.disableTheming = true
        } else {
          newState.disableTheming = false
        }

        return new Promise((resolve) => {
          this.setState(newState, () => {
            resolve()
          })
        })
      })
    }

    this.unsubscribeThemeChange = subscribeToThemeChange(this.applyStylesToIframe)
  }

  componentDidUpdate (prevProps, prevState) {
    if (
      prevState.src != null &&
      prevState.src !== this.state.src &&
      prevState.src.indexOf('blob:') === 0
    ) {
      window.URL.revokeObjectURL(prevState.src)
    }
  }

  componentWillUnmount () {
    if (this.disposePreviewChangeHandler) {
      this.disposePreviewChangeHandler()
    }

    if (this.disposePreviewConfigurationHandler) {
      this.disposePreviewConfigurationHandler()
    }

    if (this.unsubscribeThemeChange) {
      this.unsubscribeThemeChange()
    }

    if (this.props.src != null && this.props.src.indexOf('blob:') === 0) {
      window.URL.revokeObjectURL(this.props.src)
    }

    delete Preview.instances[this.instanceId]
  }

  handleOnPreviewDisplayLoad () {
    this.applyStylesToIframe()

    if (this.props.onLoad) {
      this.props.onLoad()
    }
  }

  handleOnProfilerCanvasClick () {
    this.setState((prevState) => {
      if (prevState.profilerActiveElement == null) {
        return null
      }

      return { ...prevState, profilerActiveElement: null }
    })
  }

  handleOnProfilerElementClick (meta) {
    const openInspectModal = ({ sourceId, targetId, inputId, outputId }) => {
      modalHandler.open(ProfilerInspectModal, {
        data: {
          sourceId,
          targetId,
          template: this.state.previewTemplate,
          getContent: () => {
            let basedOnCompletedState = false
            let operationWithState
            let result

            if (outputId == null) {
              operationWithState = getStateAtOperation(this.state.profilerOperations, inputId, false)
            } else if (inputId == null) {
              basedOnCompletedState = true
              operationWithState = getStateAtOperation(this.state.profilerOperations, outputId, true)
            } else {
              operationWithState = getStateAtOperation(this.state.profilerOperations, inputId, false)
            }

            if (basedOnCompletedState) {
              result = {
                reqContent: operationWithState.completedReqState,
                reqDiff: operationWithState.completedReq.diff,
                resContent: operationWithState.completedResState,
                resDiff: operationWithState.completedRes.content != null && operationWithState.completedRes.content.encoding === 'diff' ? operationWithState.completedRes.content.content : '',
                resMetaContent: operationWithState.completedResMetaState
              }
            } else {
              result = {
                reqContent: operationWithState.reqState,
                reqDiff: operationWithState.req.diff,
                resContent: operationWithState.resState,
                resDiff: operationWithState.res.content != null && operationWithState.res.content.encoding === 'diff' ? operationWithState.res.content.content : '',
                resMetaContent: operationWithState.resMetaState
              }
            }

            return result
          }
        },
        onModalClose: () => {
          this.setState({ profilerActiveElement: null })
        }
      })
    }

    if (!meta.isEdge) {
      if (meta.data.error != null && meta.data.operation == null) {
        modalHandler.open(ProfilerErrorModal, { error: meta.data.error })
      } else if (meta.data.error != null && meta.data.operation != null) {
        if (
          meta.data.error.entity != null &&
          (meta.data.error.property === 'content' || meta.data.error.property === 'helpers') &&
          meta.data.error.lineNumber != null
        ) {
          this.props.openTab({ shortid: meta.data.error.entity.shortid }).then(() => {
            setTimeout(() => {
              const entity = this.props.getEntityByShortid(meta.data.error.entity.shortid)
              const contentIsTheSame = entity.content === meta.data.error.entity.content
              const entityEditor = findTextEditor(meta.data.error.property === 'content' ? entity._id : `${entity._id}_helpers`)

              if (entityEditor != null && contentIsTheSame) {
                selectLineInTextEditor(entityEditor, { lineNumber: meta.data.error.lineNumber })
              }
            }, 300)
          })
        } else {
          modalHandler.open(ProfilerErrorModal, { error: meta.data.error })
        }
      }

      // click on start node should open inspector
      if (meta.id === 'preview-start') {
        openInspectModal({
          sourceId: meta.data.id,
          targetId: 'none',
          inputId: this.state.profilerOperations[0].id,
          outputId: null
        })
      }

      if (meta.data.operation == null) {
        this.setState({ profilerActiveElement: null })
        return
      }
    } else {
      // don't open inspect modal for profile with no req/res information saved
      if (this.state.profilerOperations[0].req == null || this.state.profilerOperations[0].res == null) {
        return
      }

      openInspectModal({
        sourceId: meta.data.edge.source,
        targetId: meta.data.edge.target,
        inputId: meta.data.edge.data.inputId,
        outputId: meta.data.edge.data.outputId
      })
    }

    this.setState((prevState) => {
      if (prevState.profilerActiveElement != null && prevState.profilerActiveElement.id === meta.id) {
        return { ...prevState, profilerActiveElement: null }
      } else {
        return { ...prevState, profilerActiveElement: meta }
      }
    })
  }

  handleOnActionMenuClick (action, data) {
    if (action === 'download') {
      const blob = new Blob([data.reportFile.rawData.buffer], { type: data.reportFile.contentType })
      fileSaver.saveAs(blob, data.reportFile.filename)
    } else if (action === 'downloadProfile') {
      const downloadEl = document.createElement('a')

      downloadEl.style.display = 'none'
      downloadEl.href = `${window.location.origin}${resolveUrl(`/api/profile/${data.profileId}/content`)}`
      downloadEl.download = `${data.profileId}.jsrprofile`

      this.actionsMenuContainerRef.current.appendChild(downloadEl)

      const evt = new window.MouseEvent('click', {
        bubbles: false,
        cancelable: false,
        view: window
      })

      downloadEl.dispatchEvent(evt)

      downloadEl.parentNode.removeChild(downloadEl)
    } else if (action === 'uploadProfile') {
      const profileName = data.file.name

      previewConfigurationHandler({
        src: null,
        id: uid(),
        template: {
          name: 'anonymous',
          shortid: null
        },
        type: 'profiler'
      }).then(() => {
        return parseProfile(data.file.stream().getReader(), (message) => {
          if (message.type === 'log') {
            this.addProfilerLog(message)
          } else if (message.type === 'operationStart' || message.type === 'operationEnd') {
            this.addProfilerOperation(message)
          } else if (message.type === 'error') {
            this.addProfilerError(message)
          }
        })
      }).catch((err) => {
        console.error(`Unable to upload profile "${profileName}"`, err)
      })
    } else if (action === 'openNewTab') {
      const previewId = this.state.previewId

      const file = new window.File([data.reportFile.rawData.buffer], data.reportFile.filename, {
        type: data.reportFile.contentType
      })

      const fileURLBlob = URL.createObjectURL(file)

      const previewURL = window.URL.createObjectURL(new Blob([`
        <html>
          <head>
            <title>Preview - ${data.templateName}</title>
            <style>
              html, body {
                margin: 0px;
                width: 100%;
                height: 100%;
              }
            </style>
          </head>
          <body>
            <iframe src="${fileURLBlob}" frameborder="0" width="100%" height="100%" />
          </body>
        </html>
      `], { type: 'text/html' }))

      const newWindow = window.open(
        previewURL,
        `preview-report-${previewId}`
      )

      const timerRef = setInterval(() => {
        if (newWindow.closed) {
          window.URL.revokeObjectURL(fileURLBlob)
          window.URL.revokeObjectURL(previewURL)
          clearInterval(timerRef)
        }
      }, 1000)
    } else if (action === 'clear') {
      this.clear()
    }
  }

  applyStylesToIframe () {
    if (!this.previewDisplayContainerRef.current || !this.previewDisplayIframeRef.current) {
      return
    }

    try {
      const { disableTheming } = this.state

      if (this.previewDisplayContainerRef.current.classList.contains(styles.previewDisplayContainerDefaultBackground)) {
        this.previewDisplayContainerRef.current.classList.remove(styles.previewDisplayContainerDefaultBackground)
      }

      const previousStyle = this.previewDisplayIframeRef.current.contentDocument.head.querySelector('style[data-jsreport-theme-styles]')

      if (previousStyle) {
        previousStyle.remove()
      }

      if (disableTheming) {
        this.previewDisplayContainerRef.current.classList.add(styles.previewDisplayContainerDefaultBackground)
        return
      }

      const containerStyles = window.getComputedStyle(this.previewDisplayContainerRef.current, null)
      const style = document.createElement('style')

      style.dataset.jsreportThemeStyles = true
      style.type = 'text/css'

      style.appendChild(document.createTextNode(`
        html, body {
          background-color: ${containerStyles.getPropertyValue('background-color')};
          color: ${containerStyles.getPropertyValue('color')};
        }
      `))

      this.previewDisplayIframeRef.current.contentDocument.head.insertBefore(
        style,
        this.previewDisplayIframeRef.current.contentDocument.head.firstChild
      )
    } catch (e) {
      // ignore error, because it was just cross-origin issues
    }
  }

  addReport (reportFileInfo) {
    this.setState({
      previewReportFile: reportFileInfo
    })
  }

  addProfilerOperation (operation) {
    this.setState((prev) => {
      let newOperations = prev.profilerOperations

      if (operation.type === 'operationEnd') {
        let foundIndex

        for (let i = prev.profilerOperations.length - 1; i >= 0; i--) {
          const targetOperation = prev.profilerOperations[i]

          if (targetOperation.id === operation.id) {
            foundIndex = i
            break
          }
        }

        if (foundIndex == null) {
          throw new Error(`Operation with id "${operation.id}" not found`)
        }

        const foundOperation = prev.profilerOperations[foundIndex]

        newOperations = [...prev.profilerOperations.slice(0, foundIndex), {
          ...foundOperation,
          completed: true,
          completedTimestamp: operation.timestamp,
          completedReq: operation.req,
          completedRes: operation.res,
          completedPreviousOperationId: operation.previousOperationId
        }, ...prev.profilerOperations.slice(foundIndex + 1)]
      } else {
        newOperations = [...prev.profilerOperations, {
          id: operation.id,
          type: operation.subtype,
          name: operation.name,
          timestamp: operation.timestamp,
          profileId: operation.profileId,
          req: operation.req,
          res: operation.res,
          previousOperationId: operation.previousOperationId,
          completed: false,
          completedTimestamp: null,
          completedReq: null,
          completedRes: null,
          completedPreviousOperationId: null
        }]
      }

      return {
        profilerOperations: newOperations
      }
    })
  }

  addProfilerLog (log) {
    this.setState((prev) => ({
      profilerLogs: [...prev.profilerLogs, {
        level: log.level,
        message: log.message,
        timestamp: log.timestamp,
        previousOperationId: log.previousOperationId
      }]
    }))
  }

  addProfilerError (errorInfo) {
    this.setState((prev) => {
      let newState = {}
      const newProfilerErrors = { ...prev.profilerErrors }
      let newProfilerOperations

      if (errorInfo.id != null && errorInfo.previousOperationId != null) {
        newProfilerErrors.operations = { ...newProfilerErrors.operations }
        newProfilerErrors.operations[errorInfo.previousOperationId] = errorInfo

        let foundIndex

        for (let i = prev.profilerOperations.length - 1; i >= 0; i--) {
          const targetOperation = prev.profilerOperations[i]

          if (targetOperation.id === errorInfo.previousOperationId) {
            foundIndex = i
            break
          }
        }

        if (foundIndex != null) {
          const foundOperation = prev.profilerOperations[foundIndex]

          newProfilerOperations = [...prev.profilerOperations.slice(0, foundIndex), {
            ...foundOperation,
            completedTimestamp: errorInfo.timestamp,
            completedPreviousOperationId: errorInfo.previousOperationId
          }, ...prev.profilerOperations.slice(foundIndex + 1)]
        }
      } else if (errorInfo.type === 'globalError') {
        newProfilerErrors.global = errorInfo
      } else {
        newProfilerErrors.general = errorInfo
      }

      newState.profilerErrors = newProfilerErrors

      if (newProfilerOperations != null) {
        newState.profilerOperations = newProfilerOperations
      }

      return newState
    })
  }

  changeSrc (newSrc, opts = {}) {
    previewFrameChangeHandler(newSrc, opts)
  }

  changeActiveTab (tabName) {
    this.setState({
      activePreviewTab: tabName
    })
  }

  clear () {
    this.setState({
      previewDisplayIframeKey: shortid.generate(),
      src: null,
      disableTheming: false,
      previewId: null,
      previewTemplate: null,
      previewType: 'normal',
      previewReportFile: null,
      activePreviewTab: 'profiler',
      profilerOperations: [],
      profilerLogs: [],
      profilerActiveElement: null,
      profilerErrors: { global: null, general: null, operations: {} }
    })
  }

  resizeStarted () {
    if (this.previewDisplayOverlayRef.current) {
      this.previewDisplayOverlayRef.current.style.display = 'block'
    }

    if (this.previewDisplayIframeRef.current) {
      this.previewDisplayIframeRef.current.style.display = 'none'
    }
  }

  resizeEnded () {
    if (this.previewDisplayOverlayRef.current) {
      this.previewDisplayOverlayRef.current.style.display = 'none'
    }

    if (this.previewDisplayIframeRef.current) {
      this.previewDisplayIframeRef.current.style.display = 'block'
    }
  }

  render () {
    const {
      previewDisplayIframeKey,
      src,
      activePreviewTab,
      expandedActionsMenu,
      previewType,
      previewReportFile,
      previewTemplate,
      profilerOperations,
      profilerLogs,
      profilerErrors,
      profilerActiveElement
    } = this.state

    const { main } = this.props
    const mainOperation = profilerOperations.find((op) => op.type === 'render')
    const isMainCompleted = previewType === 'report' ? previewReportFile != null : mainOperation != null ? mainOperation.completed === true : false
    const shouldUseTabs = previewType === 'report' || previewType === 'report-profiler' || previewType === 'profiler'
    const tabs = []

    if (shouldUseTabs) {
      if (previewType === 'report' || previewType === 'report-profiler') {
        tabs.push({
          name: 'report',
          title: 'report',
          renderContent: () => {
            return (
              <PreviewDisplay
                main={main}
                iframeKey={previewDisplayIframeKey}
                src={src}
                containerRef={this.previewDisplayContainerRef}
                overlayRef={this.previewDisplayOverlayRef}
                iframeRef={this.previewDisplayIframeRef}
                onLoad={this.handleOnPreviewDisplayLoad}
              />
            )
          }
        })
      }

      if (previewType === 'report-profiler' || previewType === 'profiler') {
        tabs.push({
          name: 'profiler',
          title: 'profiler',
          renderContent: () => {
            return (
              <ProfilerContent
                activeElement={profilerActiveElement}
                operations={profilerOperations}
                logs={profilerLogs}
                errors={profilerErrors}
                onCanvasClick={this.handleOnProfilerCanvasClick}
                onElementClick={this.handleOnProfilerElementClick}
              />
            )
          }
        })
      }
    }

    const actionsMenuComponents = []

    if (previewType === 'report' || previewType === 'report-profiler') {
      actionsMenuComponents.push(({ onMenuAction, closeMenu }) => {
        const enabled = isMainCompleted && previewReportFile != null

        return (
          <div className={enabled ? '' : 'disabled'} title='Download report output' onClick={() => {
            if (!enabled) {
              return
            }

            onMenuAction('download', { reportFile: previewReportFile })
            closeMenu()
          }}>
            <i className='fa fa-download' /><span>Download</span>
          </div>
        )
      })

      if (previewType === 'report-profiler') {
        actionsMenuComponents.push(({ onMenuAction, closeMenu }) => {
          const enabled = isMainCompleted && (profilerErrors == null || profilerErrors.global == null)

          return (
            <div className={enabled ? '' : 'disabled'} onClick={() => {
              if (!enabled) {
                return
              }

              onMenuAction('downloadProfile', { profileId: mainOperation.profileId })
              closeMenu()
            }}>
              <i className='fa fa-download' /><span>Download Profile</span>
            </div>
          )
        })
      }

      actionsMenuComponents.push(({ onMenuAction, closeMenu }) => {
        const enabled = isMainCompleted

        return (
          <div className={enabled ? '' : 'disabled'} onClick={() => {
            if (!enabled) {
              return
            }

            if (this.uploadProfileInputRef.current) {
              this.uploadProfileInputRef.current.openSelection()
            }
          }}>
            <i className='fa fa-upload' /><span>Upload Profile</span>
            <div style={{ display: 'none' }}>
              <FileInput ref={this.uploadProfileInputRef} onFileSelect={(file) => {
                onMenuAction('uploadProfile', { file })
                closeMenu()
              }} />
            </div>
          </div>
        )
      })

      actionsMenuComponents.push(({ onMenuAction, closeMenu }) => {
        const enabled = isMainCompleted && previewReportFile != null

        return (
          <div className={enabled ? '' : 'disabled'} onClick={() => {
            if (!enabled) {
              return
            }

            onMenuAction('openNewTab', { templateName: previewTemplate.name, reportFile: previewReportFile })
            closeMenu()
          }}>
            <i className='fa fa-external-link' /><span>Open in new tab</span>
          </div>
        )
      })
    }

    // TODO: undock action is still not supported because it is too complex to refactor it,
    // we should add this after we have done the preview refactor
    /*
    if (
      activeTabWithEntity &&
      activeTabWithEntity.tab &&
      activeTabWithEntity.tab.type === 'entity' &&
      activeTabWithEntity.entity &&
      activeTabWithEntity.entity.__entitySet === 'templates'
    ) {
      actionsMenuComponents.push(({ onMenuAction, closeMenu }) => {
        const enabled = mainOperation == null || isMainCompleted

        return (
          <div className={enabled ? '' : 'disabled'} title='Undock preview pane into extra browser tab' onClick={() => {
            if (!enabled) {
              return
            }

            onMenuAction('undock')
            closeMenu()
          }}>
            <i className='fa fa-window-restore' /><span>Undock to new tab</span>
          </div>
        )
      })
    }
    */

    actionsMenuComponents.push(({ onMenuAction, closeMenu }) => (
      <div onClick={() => {
        onMenuAction('clear')
        closeMenu()
      }}>
        <i className='fa fa-times' /><span>Clear</span>
      </div>
    ))

    return (
      <div className={styles.previewContainer}>
        <Fragment>
          <div className={styles.previewTitles}>
            {shouldUseTabs && tabs.map((t) => {
              const isActive = activePreviewTab === t.name

              const previewTabClass = classNames(styles.previewTitle, {
                [styles.active]: isActive
              })

              return (
                <div key={`${t.name}-title`} className={previewTabClass} onClick={() => this.changeActiveTab(t.name)}>
                  <span>{t.icon != null ? (
                    <span className={styles.previewTitleIcon}><i className={`fa ${t.icon || ''}`} />&nbsp;</span>
                  ) : ''}{t.title}</span>
                </div>
              )
            })}
            <div
              key='preview-actions'
              ref={this.actionsMenuTriggerRef}
              className={styles.previewTitle}
              onClick={(e) => {
                e.stopPropagation()

                if (
                  this.actionsMenuTriggerRef.current.contains(e.target) &&
                  !this.actionsMenuContainerRef.current.contains(e.target)
                ) {
                  this.setState((prevState) => ({ expandedActionsMenu: !prevState.expandedActionsMenu }))
                }
              }}
            >
              <span title='Preview actions menu'>...</span>
              <PreviewActionsMenu
                ref={this.actionsMenuContainerRef}
                open={expandedActionsMenu}
                actionsComponents={actionsMenuComponents}
                onMenuAction={this.handleOnActionMenuClick}
                onRequestClose={() => this.setState({ expandedActionsMenu: false })}
              />
            </div>
          </div>
          <div className='block'>
            {shouldUseTabs ? tabs.map((t) => {
              const isActive = activePreviewTab === t.name

              return (
                <div key={`${t.name}-content`} className='block' style={{ display: isActive ? 'flex' : 'none' }}>
                  {t.renderContent()}
                </div>
              )
            }) : (
              <PreviewDisplay
                main={main}
                iframeKey={previewDisplayIframeKey}
                src={src}
                containerRef={this.previewDisplayContainerRef}
                overlayRef={this.previewDisplayOverlayRef}
                iframeRef={this.previewDisplayIframeRef}
                onLoad={this.handleOnPreviewDisplayLoad}
              />
            )}
          </div>
        </Fragment>
      </div>
    )
  }
}

export { Preview }

export default connect(
  (state) => ({
    activeTabWithEntity: editorSelectors.getActiveTabWithEntity(state),
    lastActiveTemplate: editorSelectors.getLastActiveTemplate(state),
    getEntityByShortid: (shortid, ...params) => entitiesSelectors.getByShortid(state, shortid, ...params)
  }),
  { ...editorActions },
  null,
  { forwardRef: true }
)(Preview)
