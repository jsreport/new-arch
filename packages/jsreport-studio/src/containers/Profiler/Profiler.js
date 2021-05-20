import React, { Component } from 'react'
import { connect } from 'react-redux'
import api from '../../helpers/api'
import resolveUrl from '../../helpers/resolveUrl'
import openProfileFromStreamReader from '../../helpers/openProfileFromStreamReader'
import storeMethods from '../../redux/methods'
import { actions as settingsActions } from '../../redux/settings'

class Profiler extends Component {
  constructor () {
    super()
    this.state = { profiles: [] }
  }

  componentDidMount () {
    this.loadProfiles()
    this._interval = setInterval(() => this.loadProfiles(), 5000)
  }

  async loadProfiles () {
    const response = await api.get('/odata/profiles?$orderby=timestamp desc')

    this.setState({
      profiles: response.value.map(p => {
        let template = storeMethods.getEntityByShortid(p.templateShortid, false)

        if (!template) {
          template = { name: 'anonymous', path: 'anonymous' }
        } else {
          template = { ...template, path: storeMethods.resolveEntityPath(template) }
        }

        return {
          ...p,
          template
        }
      })
    })
  }

  componentWillUnmount () {
    clearInterval(this._interval)
  }

  renderProfiles (profiles) {
    const { openTab } = this.props

    return (
      <div>
        <h2><i className='fa fa-spinner fa-spin fa-fw' /> profiling {storeMethods.getSettingsByKey('fullProfilerRunning', false) ? 'with request data' : ''} ...</h2>

        <div>
          <table className='table'>
            <thead>
              <tr>
                <th>template</th>
                <th>started</th>
                <th>state</th>
              </tr>
            </thead>
            <tbody>
              {(profiles).map((p, k) => (
                <tr key={k} onClick={() => this.openProfile(p)}>
                  <td className='selection'>
                    <a style={{ textDecoration: 'underline' }} onClick={() => p.template._id ? openTab({ _id: p.template._id }) : null}>
                      {p.template.path}
                    </a>
                  </td>
                  <td>{new Date(p.timestamp).toLocaleString()}</td>
                  <td>{p.state}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  async openProfile (p) {
    try {
      await openProfileFromStreamReader(async () => {
        const getBlobUrl = resolveUrl(`/api/profile/${p._id}/content`)

        const response = await window.fetch(getBlobUrl, {
          method: 'GET',
          cache: 'no-cache'
        })

        if (response.status !== 200) {
          throw new Error(`Got not ok response, status: ${response.status}`)
        }

        return response.body.getReader()
      }, {
        name: p.template.name,
        shortid: p.template.shortid
      })
    } catch (e) {
      const newError = new Error(`Open profile "${p._id}" failed. ${e.message}`)

      newError.stack = e.stack
      Object.assign(newError, e)

      throw newError
    }
  }

  startFullRequestProfiling () {
    this.props.update('fullProfilerRunning', true)
  }

  stopFullRequestProfiling () {
    this.props.update('fullProfilerRunning', false)
  }

  render () {
    return (
      <div className='block custom-editor' style={{ overflow: 'auto', minHeight: 0, height: 'auto' }}>
        <div>
          {storeMethods.getSettingsByKey('fullProfilerRunning', false)
            ? <button className='button danger' onClick={() => this.stopFullRequestProfiling()}>Stop full requests profiling</button>
            : <button className='button danger' onClick={() => this.startFullRequestProfiling()}>Start full requests profiling</button>}
        </div>
        {this.renderProfiles(this.state.profiles)}
      </div>
    )
  }
}

export default connect(
  undefined,
  { ...settingsActions },
  undefined,
  { forwardRef: true }
)(Profiler)
