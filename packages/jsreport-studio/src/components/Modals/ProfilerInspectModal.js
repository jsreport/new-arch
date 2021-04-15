import { Component } from 'react'
import { connect } from 'react-redux'
import shortid from 'shortid'
import fileSaver from 'filesaver.js-npm'
import { actions as editorActions } from '../../redux/editor'
import uid from '../../helpers/uid.js'
import resolveUrl from '../../helpers/resolveUrl.js'
import b64toBlob from '../Preview/b64toBlob'

class ProfilerInspectModal extends Component {
  constructor (props) {
    super(props)

    this.handleOpenTemplateClick = this.handleOpenTemplateClick.bind(this)
    this.handleOpenDataClick = this.handleOpenDataClick.bind(this)
    this.handleOpenRequestClick = this.handleOpenRequestClick.bind(this)
    this.handleResponse = this.handleResponse.bind(this)

    this.state = {
      content: null
    }
  }

  componentDidMount () {
    setTimeout(() => {
      const content = this.props.options.data.getContent()
      let parsedReqContent
      let parsedResMetaContent

      try {
        parsedReqContent = JSON.parse(content.reqContent)
        parsedResMetaContent = content.resMetaContent != null && content.resMetaContent !== '' ? JSON.parse(content.resMetaContent) : {}
      } catch (e) {
        console.error('Unable to parse inspect content. Details:', e.message)
        return
      }

      this.setState({
        content: {
          ...content,
          parsedReqContent,
          parsedResMetaContent
        }
      })
    }, 250)
  }

  componentWillUnmount () {
    this.props.options.onModalClose()
  }

  handleOpenTemplateClick () {
    const stepId = `${this.props.options.data.sourceId}-${this.props.options.data.targetId}`
    const reqContent = this.state.content.parsedReqContent

    if (reqContent != null) {
      this.props.openTab({
        key: `profiler-inspect-request-template-${stepId}`,
        title: `Profiler inspect - ${this.props.options.data.template.name} (template)`,
        customUrl: resolveUrl(`/studio/templates/${this.props.options.data.template.shortid}`),
        getEntity: () => Object.assign({}, reqContent.template, {
          _id: uid(),
          shortid: shortid.generate(),
          __entitySet: 'templates'
        }),
        readOnly: true
      })
    }
  }

  handleOpenDataClick () {
    const stepId = `${this.props.options.data.sourceId}-${this.props.options.data.targetId}`
    const reqContent = this.state.content.parsedReqContent

    const key = `profiler-inspect-request-template-${stepId}-data`

    this.props.openTab({
      key,
      title: `Profiler inspect - ${this.props.options.data.template.name} (data)`,
      customUrl: resolveUrl(`/studio/templates/${this.props.options.data.template.shortid}`),
      editorComponentKey: 'inspectJSON',
      readOnly: true,
      getProps: () => ({
        jsonId: key,
        jsonName: `${this.props.options.data.template.name} (data)`,
        jsonContent: JSON.stringify(reqContent.data, null, 2)
      })
    })
  }

  handleOpenRequestClick () {
    const stepId = `${this.props.options.data.sourceId}-${this.props.options.data.targetId}`
    const reqContent = this.state.content.reqContent

    const key = `profiler-inspect-request-template-${stepId}-request`

    this.props.openTab({
      key,
      title: `Profiler inspect - ${this.props.options.data.template.name} (request)`,
      customUrl: resolveUrl(`/studio/templates/${this.props.options.data.template.shortid}`),
      editorComponentKey: 'inspectJSON',
      readOnly: true,
      getProps: () => ({
        jsonId: key,
        jsonName: `${this.props.options.data.template.name} (request)`,
        jsonContent: reqContent
      })
    })
  }

  handleResponse (download) {
    const stepId = `${this.props.options.data.sourceId}-${this.props.options.data.targetId}`
    const { resDiff, resContent } = this.state.content
    const parsedMeta = this.state.content.parsedResMetaContent

    if (parsedMeta.contentEncoding == null) {
      parsedMeta.contentEncoding = resDiff !== '' ? 'plain' : 'base64'
    }

    if (parsedMeta.contentType == null) {
      parsedMeta.contentType = 'text/plain'
    }

    if (parsedMeta.fileExtension == null) {
      parsedMeta.fileExtension = 'txt'
    }

    if (parsedMeta.reportName == null) {
      parsedMeta.reportName = this.props.options.data.template.name
    }

    let blob

    if (parsedMeta.contentEncoding === 'base64') {
      blob = b64toBlob(resContent, parsedMeta.contentType)
    } else if (parsedMeta.contentEncoding === 'plain') {
      blob = new Blob([resContent], { type: parsedMeta.contentType })
    }

    if (blob == null) {
      return
    }

    if (download) {
      fileSaver.saveAs(blob, `${parsedMeta.reportName}.${parsedMeta.fileExtension}`)
    } else {
      const responseContentURL = window.URL.createObjectURL(blob)

      const previewURL = window.URL.createObjectURL(new Blob([`
        <html>
          <head>
            <title>Profiler inspect - ${this.props.options.data.template.name} (response)</title>
            <style>
              html, body {
                margin: 0px;
                width: 100%;
                height: 100%;
              }
            </style>
          </head>
          <body>
            <iframe src="${responseContentURL}" frameborder="0" width="100%" height="100%" />
          </body>
        </html>
      `], { type: 'text/html' }))

      const newWindow = window.open(
        previewURL,
        `profiler-inspect-response-${stepId}-content`
      )

      const timerRef = setInterval(() => {
        if (newWindow.closed) {
          window.URL.revokeObjectURL(responseContentURL)
          window.URL.revokeObjectURL(previewURL)
          clearInterval(timerRef)
        }
      }, 1000)
    }
  }

  render () {
    const isLoading = this.state.content == null
    const reqActionsEnabled = this.state.content != null
    const resActionsEnabled = this.state.content != null && this.state.content.resContent !== ''

    return (
      <div>
        <h3>Inspect Render Step <i className='fa fa-circle-o-notch fa-spin' style={{ display: isLoading ? 'inline-block' : 'none' }} /></h3>
        <div className='form-group'>
          <h5>
            <b>Request state actions</b>
          </h5>
          <div>
            <button
              className={`button confirmation ${reqActionsEnabled ? '' : 'disabled'}`}
              style={{ marginLeft: 0 }}
              onClick={this.handleOpenTemplateClick}
              disabled={!reqActionsEnabled}
            >
              <i className='fa fa-file' style={{ verticalAlign: 'middle' }} /> Open Template
            </button>
            <button
              className={`button confirmation ${reqActionsEnabled ? '' : 'disabled'}`}
              onClick={this.handleOpenDataClick}
              disabled={!reqActionsEnabled}
            >
              <i className='fa fa-database' style={{ verticalAlign: 'middle' }} /> Open Data
            </button>
            <button
              className={`button confirmation ${reqActionsEnabled ? '' : 'disabled'}`}
              onClick={this.handleOpenRequestClick}
              disabled={!reqActionsEnabled}
            >
              <i className='fa fa-plug' style={{ verticalAlign: 'middle' }} /> Open Request
            </button>
          </div>
        </div>
        <br />
        <div className='form-group'>
          <h5>
            <b>Response state actions</b>
          </h5>
          <div>
            <button
              className={`button confirmation ${resActionsEnabled ? '' : 'disabled'}`}
              style={{ marginLeft: 0 }}
              onClick={() => this.handleResponse(true)}
              disabled={!resActionsEnabled}
            >
              <i className='fa fa-download' style={{ verticalAlign: 'middle' }} /> Download Response
            </button>
            <button
              className={`button confirmation ${resActionsEnabled ? '' : 'disabled'}`}
              onClick={() => this.handleResponse()}
              disabled={!resActionsEnabled}
            >
              <i className='fa fa-external-link' style={{ verticalAlign: 'middle' }} /> Open Response
            </button>
          </div>
        </div>
      </div>
    )
  }
}

export default connect(undefined, {
  openTab: editorActions.openTab
})(ProfilerInspectModal)
