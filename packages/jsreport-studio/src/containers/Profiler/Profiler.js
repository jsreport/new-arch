import React, { Component } from 'react'
import { connect } from 'react-redux'
import api from '../../helpers/api.js'
import { selectors as entitiesSelectors } from '../../redux/entities'
import { previewFrameChangeHandler } from '../../lib/configuration.js'
import { actions as settingsActions, selectors as settingsSelectors } from '../../redux/settings'

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
        let template = this.props.getByShortid(p.templateShortid, false)

        if (!template) {
          template = { name: 'anonymous', path: 'anonymous' }
        } else {
          template = { ...template, path: this.props.resolveEntityPath(template) }
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
        <h2><i className='fa fa-spinner fa-spin fa-fw' /> profiling {this.props.gettSettingsByKey('fullProfilerRunning') ? 'with request data' : ''} ...</h2>

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
    const ab = await api.get(`/api/profile/${p._id}/content`, { responseType: 'arraybuffer' })
    const str = String.fromCharCode.apply(null, new Uint8Array(ab))

    return previewFrameChangeHandler('data:text/html;charset=utf-8,' + encodeURI(str))
  }

  startFullRequestProfiling () {
    this.props.update('fullProfilerRunning', true)
  }

  stopFullRequestProfiling () {
    this.props.update('fullProfilerRunning', false)
  }

  render () {
    return <div className='block custom-editor' style={{ overflow: 'auto', minHeight: 0, height: 'auto' }}>
      <div>
        {this.props.gettSettingsByKey('fullProfilerRunning')
          ? <button className='button danger' onClick={() => this.stopFullRequestProfiling()}>Stop full requests profiling</button>
          : <button className='button danger' onClick={() => this.startFullRequestProfiling()}>Start full requests profiling</button>
        }
      </div>
      {this.renderProfiles(this.state.profiles)}
    </div>
  }
}

export default connect((state) => ({
  resolveEntityPath: (...params) => entitiesSelectors.resolveEntityPath(state, ...params),
  getByShortid: (...params) => entitiesSelectors.getByShortid(state, ...params),
  gettSettingsByKey: (...params) => settingsSelectors.getValueByKey(state, ...params)
}), { ...settingsActions }, undefined, { forwardRef: true })(Profiler)
