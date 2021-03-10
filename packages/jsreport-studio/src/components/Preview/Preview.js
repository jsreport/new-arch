import PropTypes from 'prop-types'
import React, { Fragment, Component } from 'react'
import classNames from 'classnames'
import shortid from 'shortid'
import { applyPatch } from 'diff'
import PreviewDisplay from './PreviewDisplay'
import ProfilerContent from './ProfilerContent'
import {
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
      profilerErrors: { general: null, operations: {} }
    }

    this.handleOnPreviewDisplayLoad = this.handleOnPreviewDisplayLoad.bind(this)
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
    console.log(operation)
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

        if (foundIndex !== 0) {
          for (let i = prev.profilerOperations.length - 1; i >= 0; i--) {
            const targetOperation = prev.profilerOperations[i]

            if (targetOperation.id === foundOperation.previousOperationId) {
              previousFoundIndex = i
              break
            }
          }
        } else {
          previousFoundIndex = prev.profilerOperations.length - 1
        }

        if (previousFoundIndex == null) {
          throw new Error(`Previous operation with id "${foundOperation.previousOperationId}" not found`)
        }

        const previousOperation = prev.profilerOperations[previousFoundIndex]

        let completedReqState
        let completedResState

        completedReqState = applyPatch(
          foundIndex !== 0 ? foundOperation.reqState : prev.profilerOperations[prev.profilerOperations.length - 1].reqState,
          operation.req.diff
        )

        if (operation.res.content != null) {
          if (operation.res.content.encoding === 'diff') {
            completedResState = applyPatch(
              foundIndex !== 0 ? foundOperation.resState : prev.profilerOperations[prev.profilerOperations.length - 1].resState,
              operation.res.content.content
            )
          } else {
            completedResState = operation.res.content.content
          }
        } else {
          completedResState = previousOperation.completedResState
        }

        newOperations = [...prev.profilerOperations.slice(0, foundIndex), {
          ...foundOperation,
          completed: true,
          completedTimestamp: operation.timestamp,
          completedReq: operation.req,
          completedReqState,
          completedRes: operation.res,
          completedResState
        }, ...prev.profilerOperations.slice(foundIndex + 1)]
      } else {
        let reqState
        let resState
        let prevOperation

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

          prevOperation = prev.profilerOperations[foundIndex]
        }

        reqState = applyPatch(prevOperation != null ? (
          prevOperation.completed ? prevOperation.completedReqState : prevOperation.reqState
        ) : '', operation.req.diff)

        if (prevOperation != null) {
          if (operation.res.content != null) {
            if (operation.res.content.encoding === 'diff') {
              resState = applyPatch(prevOperation.completed ? prevOperation.completedResState : prevOperation.resState, operation.res.content.content)
            } else {
              resState = operation.res.content.content
            }
          } else {
            resState = prevOperation.completed ? prevOperation.completedResState : prevOperation.resState
          }
        } else {
          resState = ''
        }

        newOperations = [...prev.profilerOperations, {
          id: operation.id,
          type: operation.subtype,
          name: operation.name,
          timestamp: operation.timestamp,
          req: operation.req,
          reqState,
          res: operation.res,
          resState,
          completed: false,
          completedTimestamp: null,
          completedReq: null,
          completedRes: null,
          previousOperationId: operation.previousOperationId
        }]
      }

      return {
        profilerOperations: newOperations
      }
    })
  }

  addProfilerLog (log) {
    console.log(log)
    this.setState((prev) => ({
      profilerLogs: [...prev.profilerLogs, {
        level: log.level,
        message: log.message,
        timestamp: log.timestamp,
        previousOperationId: log.previousOperationId
      }]
    }))
  }

  addProfilerError (errorInfo, operationId) {
    console.warn(errorInfo)
    this.setState((prev) => {
      const newProfilerErrors = { ...prev.profilerErrors }

      if (operationId != null) {
        newProfilerErrors.operations = { ...newProfilerErrors.operations }
        newProfilerErrors.operations[operationId] = errorInfo
      } else {
        newProfilerErrors.general = errorInfo
      }

      return {
        profilerErrors: newProfilerErrors
      }
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
      profilerLogs: []
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
      profilerErrors
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
              operations={profilerOperations}
              logs={profilerLogs}
              errors={profilerErrors}
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

export default Preview
