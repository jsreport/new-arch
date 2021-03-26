import PropTypes from 'prop-types'
import React, { Fragment, Component } from 'react'
import { connect } from 'react-redux'
import classNames from 'classnames'
import shortid from 'shortid'
import { applyPatch } from 'diff'
import PreviewDisplay from './PreviewDisplay'
import ProfilerContent from './ProfilerContent'
import ProfilerErrorModal from '../Modals/ProfilerErrorModal'
import { selectors as entitiesSelectors } from '../../redux/entities'
import { actions as editorActions } from '../../redux/editor'
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

    this.state = {
      previewDisplayIframeKey: shortid.generate(),
      src: this.props.initialSrc,
      previewId: null,
      previewType: 'normal',
      disableTheming: false,
      activePreviewTab: 'profiler',
      profilerOperations: [],
      profilerLogs: [],
      profilerActiveElement: null,
      profilerErrors: { global: null, general: null, operations: {} }
    }

    this.handleOnPreviewDisplayLoad = this.handleOnPreviewDisplayLoad.bind(this)
    this.handleOnProfilerCanvasClick = this.handleOnProfilerCanvasClick.bind(this)
    this.handleOnProfilerElementClick = this.handleOnProfilerElementClick.bind(this)
    this.applyStylesToIframe = this.applyStylesToIframe.bind(this)
    this.addProfilerOperation = this.addProfilerOperation.bind(this)
    this.addProfilerLog = this.addProfilerLog.bind(this)
    this.changeSrc = this.changeSrc.bind(this)
    this.changeActiveTab = this.changeActiveTab.bind(this)
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
          newState.previewType = opts.type
          newState.profilerOperations = []
          newState.profilerLogs = []
          newState.profilerActiveElement = null
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
        }
      }

      if (meta.data.operation == null) {
        this.setState({ profilerActiveElement: null })
        return
      }
    }

    this.setState((prevState) => {
      if (prevState.profilerActiveElement != null && prevState.profilerActiveElement.id === meta.id) {
        return { ...prevState, profilerActiveElement: null }
      } else {
        return { ...prevState, profilerActiveElement: meta }
      }
    })
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

  addProfilerOperation (operation) {
    this.setState((prev) => {
      let newOperations = prev.profilerOperations

      if (operation.type === 'operationEnd') {
        let foundIndex
        let previousFoundIndex

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

        for (let i = prev.profilerOperations.length - 1; i >= 0; i--) {
          const targetOperation = prev.profilerOperations[i]

          if (targetOperation.id === operation.previousOperationId) {
            previousFoundIndex = i
            break
          }
        }

        if (previousFoundIndex == null) {
          throw new Error(`Previous operation with id "${operation.previousOperationId}" not found`)
        }

        const previousOperation = prev.profilerOperations[previousFoundIndex]

        let completedReqState
        let completedResState
        let completedResMetaState

        completedReqState = applyPatch(
          previousOperation.type === 'render' || operation.id === previousOperation.id ? (
            previousOperation.reqState
          ) : previousOperation.completed ? previousOperation.completedReqState : previousOperation.reqState,
          operation.req.diff
        )

        if (operation.res.content != null) {
          if (operation.res.content.encoding === 'diff') {
            completedResState = applyPatch(
              previousOperation.type === 'render' || operation.id === previousOperation.id ? (
                previousOperation.resState
              ) : previousOperation.completed ? previousOperation.completedResState : previousOperation.resState,
              operation.res.content.content
            )
          } else {
            completedResState = operation.res.content.content
          }
        } else {
          completedResState = previousOperation.completed ? previousOperation.completedResState : previousOperation.resState
        }

        completedResMetaState = applyPatch(
          previousOperation.type === 'render' || operation.id === previousOperation.id ? (
            previousOperation.resMetaState
          ) : previousOperation.completed ? previousOperation.completedResMetaState : previousOperation.resMetaState,
          operation.res.meta.diff
        )

        newOperations = [...prev.profilerOperations.slice(0, foundIndex), {
          ...foundOperation,
          completed: true,
          completedTimestamp: operation.timestamp,
          completedReq: operation.req,
          completedReqState,
          completedRes: operation.res,
          completedResState,
          completedResMetaState,
          completedPreviousOperationId: operation.previousOperationId
        }, ...prev.profilerOperations.slice(foundIndex + 1)]
      } else {
        let reqState
        let resState
        let resMetaState
        let previousOperation

        if (operation.previousOperationId != null) {
          let foundIndex

          for (let i = prev.profilerOperations.length - 1; i >= 0; i--) {
            const targetOperation = prev.profilerOperations[i]

            if (targetOperation.id === operation.previousOperationId) {
              foundIndex = i
              break
            }
          }

          if (foundIndex == null) {
            throw new Error(`Previous operation with id "${operation.previousOperationId}" not found`)
          }

          previousOperation = prev.profilerOperations[foundIndex]
        }

        reqState = applyPatch(previousOperation != null ? (
          previousOperation.type === 'render' ? previousOperation.reqState : previousOperation.completedReqState
        ) : '', operation.req.diff)

        if (previousOperation != null) {
          if (operation.res.content != null) {
            if (operation.res.content.encoding === 'diff') {
              resState = applyPatch(previousOperation.type === 'render' ? previousOperation.resState : previousOperation.completedResState, operation.res.content.content)
            } else {
              resState = operation.res.content.content
            }
          } else {
            resState = previousOperation.type === 'render' ? previousOperation.resState : previousOperation.completedResState
          }
        } else {
          resState = ''
        }

        resMetaState = applyPatch(previousOperation != null ? (
          previousOperation.type === 'render' ? previousOperation.resMetaState : previousOperation.completedResMetaState
        ) : '', operation.res.meta.diff)

        newOperations = [...prev.profilerOperations, {
          id: operation.id,
          type: operation.subtype,
          name: operation.name,
          timestamp: operation.timestamp,
          req: operation.req,
          reqState,
          res: operation.res,
          resState,
          resMetaState,
          previousOperationId: operation.previousOperationId,
          completed: false,
          completedTimestamp: null,
          completedReq: null,
          completedRes: null,
          completedResMetaState: null,
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
      previewType: 'normal',
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
      previewType,
      profilerOperations,
      profilerLogs,
      profilerErrors,
      profilerActiveElement
    } = this.state

    const { main } = this.props
    let previewContent

    if (previewType === 'report') {
      const tabs = [{
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
      }, {
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
      }]

      previewContent = (
        <Fragment>
          <div className={styles.previewTitles}>
            {tabs.map((t) => {
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
          </div>
          <div className='block'>
            {tabs.map((t) => {
              const isActive = activePreviewTab === t.name

              return (
                <div key={`${t.name}-content`} className='block' style={{ display: isActive ? 'flex' : 'none' }}>
                  {t.renderContent()}
                </div>
              )
            })}
          </div>
        </Fragment>
      )
    } else {
      previewContent = (
        <div className='block'>
          <PreviewDisplay
            main={main}
            iframeKey={previewDisplayIframeKey}
            src={src}
            containerRef={this.previewDisplayContainerRef}
            overlayRef={this.previewDisplayOverlayRef}
            iframeRef={this.previewDisplayIframeRef}
            onLoad={this.handleOnPreviewDisplayLoad}
          />
        </div>
      )
    }

    return (
      <div className={styles.previewContainer}>
        {previewContent}
      </div>
    )
  }
}

export default connect(
  (state) => ({
    getEntityByShortid: (shortid, ...params) => entitiesSelectors.getByShortid(state, shortid, ...params)
  }),
  { ...editorActions },
  null,
  { forwardRef: true }
)(Preview)
