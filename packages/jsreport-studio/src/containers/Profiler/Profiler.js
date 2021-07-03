import React, { Component } from 'react'
import { connect } from 'react-redux'
import api from '../../helpers/api'
import resolveUrl from '../../helpers/resolveUrl'
import openProfileFromStreamReader from '../../helpers/openProfileFromStreamReader'
import storeMethods from '../../redux/methods'
import { actions as settingsActions } from '../../redux/settings'
import moment from 'moment'

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

  stateStyle (state) {
    const style = {
      fontSize: '0.8rem',
      padding: '0.3rem',
      display: 'inline-block',
      textAlign: 'center',
      minWidth: '4rem',
      color: 'white'
    }

    if (state === 'success') {
      style.backgroundColor = '#4CAF50'
    }

    if (state === 'error') {
      style.backgroundColor = '#da532c'
    }

    if (state === 'running') {
      style.backgroundColor = '#007acc'
    }

    return style
  }

  renderProfiles (profiles) {
    const { openTab } = this.props

    return (
      <div>
        <div>
          <table className='table' style={{ marginTop: '1rem' }}>
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
                  <td>{
                    (new Date().getTime() - new Date(p.timestamp).getTime()) > (1000 * 60 * 60 * 24)
                      ? new Date(p.timestamp).toLocaleString()
                      : moment.duration(moment(new Date()).diff(moment(new Date(p.timestamp)))).humanize() + ' ago'
                      }
                  </td>
                  <td><span style={this.stateStyle(p.state)}>{p.state}</span></td>
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
        const getBlobUrl = resolveUrl(`/api/profile/${p._id}/events`)

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
        <div title='Profiler now automatically pops up running requests. Use button "Start full requests profiling" to collect full information about the running requests like input data and output report. Note this slightly degrades the requests performance and should not be enabled constantly.'>
          <h2><i className='fa fa-spinner fa-spin fa-fw' /> profiling {storeMethods.getSettingsByKey('fullProfilerRunning', false) ? 'with request data' : ''}... <i className='fa fa-info-circle' />
          </h2>
          <div>
            {storeMethods.getSettingsByKey('fullProfilerRunning', false)
              ? <button className='button danger' style={{ marginLeft: '0rem' }} onClick={() => this.stopFullRequestProfiling()}> Stop full requests profiling</button>
              : <button className='button danger' style={{ marginLeft: '0rem' }} onClick={() => this.startFullRequestProfiling()}>Start full requests profiling</button>}
          </div>
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
