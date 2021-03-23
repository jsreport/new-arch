import { Component } from 'react'
import api from '../../helpers/api'
import styles from './ProfilerInspectReqResModal.css'

class ProfilerInspectReqResModal extends Component {
  constructor (props) {
    super(props)

    this.state = {
      loading: false,
      viewMode: 'content'
    }

    this.handleViewButtonClick = this.handleViewButtonClick.bind(this)
  }

  componentWillUnmount () {
    if (this.state.viewDiffURL != null) {
      window.URL.revokeObjectURL(this.state.viewDiffURL)
    }
  }

  async handleViewButtonClick () {
    const { diff } = this.props.options
    const { loading, viewMode } = this.state
    let newState = {}
    let newViewMode

    if (loading) {
      return
    }

    if (viewMode === 'content') {
      newViewMode = 'diff'

      this.setState({ loading: true })

      try {
        const diffHTML = await api.post('/studio/diff-html', {
          parseJSON: false,
          data: {
            patch: diff
          }
        })

        newState.viewDiffURL = window.URL.createObjectURL(new Blob([diffHTML], { type: 'text/html' }))
      } finally {
        this.setState({ loading: false })
      }
    } else {
      newViewMode = 'content'
      window.URL.revokeObjectURL(this.state.viewDiffURL)
    }

    newState.viewMode = newViewMode

    this.setState(newState)
  }

  renderContent () {
    const { viewMode, viewDiffURL } = this.state
    const { content } = this.props.options

    if (viewMode === 'content') {
      return (
        <pre className={styles.content}>
          {content}
        </pre>
      )
    } else if (viewMode === 'diff') {
      return (
        <iframe
          frameBorder='0'
          src={viewDiffURL == null ? 'about:blank' : viewDiffURL}
          style={{ marginTop: 0, width: '650px', height: '500px' }}
        />
      )
    }

    return null
  }

  render () {
    const { loading, viewMode } = this.state
    const { close, options } = this.props
    const { title, diff } = options

    const shouldDisableBtn = loading || (viewMode === 'content' && (diff == null || diff === ''))

    return (
      <div>
        <h3>{title}</h3>
        <div>
          <button
            className={`button confirmation ${shouldDisableBtn ? 'disabled' : ''}`}
            onClick={this.handleViewButtonClick}
            style={{ marginLeft: 0 }}
            disabled={shouldDisableBtn}
          >
            View {viewMode === 'content' ? 'diff' : 'content'}
          </button>
        </div>
        <div className={`form-group ${styles.container}`}>
          {this.renderContent()}
        </div>
        <div className='button-bar'>
          <button className='button confirmation' onClick={() => close()}>Ok</button>
        </div>
      </div>
    )
  }
}

export default ProfilerInspectReqResModal
