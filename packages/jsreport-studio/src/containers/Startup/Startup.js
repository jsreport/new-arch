import React, { Component } from 'react'
import { connect } from 'react-redux'
import { Line } from 'react-chartjs-2'
import { actions } from '../../redux/editor'
import { selectors as entitiesSelectors } from '../../redux/entities'
import uid from '../../helpers/uid'
import api from '../../helpers/api'
import resolveUrl from '../../helpers/resolveUrl'
import parseProfile from '../../helpers/parseProfile'
import NewTemplateModal from '../../components/Modals/NewTemplateModal'
import { modalHandler, previewConfigurationHandler } from '../../lib/configuration'

function randomColor () {
  const hue = Math.floor(Math.random() * 360)
  return 'hsl(' + hue + ', 100%, 80%)'
}

class Startup extends Component {
  constructor () {
    super()
    this.state = { templates: [], profiles: [], monitoring: [], loadingProfile: false }
    this.openProfile = this.openProfile.bind(this)
  }

  async onTabActive () {
    if (this._loading) {
      return
    }
    this._loading = true

    try {
      await this.loadLastModifiedTemplates()
      await this.loadProfiles()
      await this.loadMonitoring()
    } finally {
      this._loading = false
    }
  }

  async loadLastModifiedTemplates () {
    const response = await api.get('/odata/templates?$top=5&$select=name,recipe,modificationDate&$orderby=modificationDate desc')

    this.setState({
      templates: response.value.map((t) => ({
        ...t,
        path: this.props.resolveEntityPath(t)
      }))
    })
  }

  async loadProfiles () {
    const response = await api.get('/odata/profiles?$top=10&$orderby=timestamp desc')

    this.setState({
      profiles: response.value.map(p => {
        let template = this.props.getByShortid(p.templateShortid, false)

        if (!template) {
          template = { name: 'anonymous', shortid: null, path: 'anonymous' }
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

  async loadMonitoring () {
    const response = await api.get('/odata/monitoring')

    const servers = response.value.reduce((t, a) => {
      t[a.hostname] = t[a.hostname] || []
      t[a.hostname].push(a)
      return t
    }, {})

    this.setState({
      monitoring: Object.keys(servers).map(k => ({
        label: k,
        borderColor: randomColor(),
        data: servers[k]
      }))
    })
  }

  shouldComponentUpdate (props) {
    return props.activeTabKey === 'StartupPage'
  }

  async openProfile (p) {
    const { addProfilerOperation, addProfilerLog, addProfilerError } = this.props

    this.setState({
      loadingProfile: true
    })

    await previewConfigurationHandler({
      src: null,
      id: uid(),
      template: {
        name: p.template.name,
        shortid: p.template.shortid
      },
      type: 'profiler'
    })

    try {
      const getBlobUrl = resolveUrl(`/api/profile/${p._id}/content`)

      const response = await window.fetch(getBlobUrl, {
        method: 'GET',
        cache: 'no-cache'
      })

      if (response.status !== 200) {
        throw new Error(`Got not ok response, status: ${response.status}`)
      }

      const reader = response.body.getReader()

      await parseProfile(reader, (message) => {
        if (message.type === 'log') {
          addProfilerLog(message)
        } else if (message.type === 'operationStart' || message.type === 'operationEnd') {
          addProfilerOperation(message)
        } else if (message.type === 'error') {
          addProfilerError(message)
        }
      })
    } catch (e) {
      const newError = new Error(`Open profile "${p._id}" failed. ${e.message}`)

      newError.stack = e.stack
      Object.assign(newError, e)

      throw newError
    } finally {
      this.setState({
        loadingProfile: false
      })
    }
  }

  renderProfiles (profiles) {
    const { loadingProfile } = this.state
    const { openTab } = this.props

    return (
      <div>
        <h2>Last requests' profiles <i className='fa fa-circle-o-notch fa-spin' style={{ display: loadingProfile ? 'inline-block' : 'none' }} /></h2>

        <div>
          <table className='table'>
            <thead>
              <tr>
                <th>template</th>
                <th>started</th>
                <th>duration</th>
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
                  <td>{p.finishedOn ? ((p.finishedOn - p.timestamp) + ' ms') : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  renderRequestsCountChart (profiles) {
    const successfullRequests = profiles.filter(p => p.state === 'success').reduce((t, a) => {
      const minutes = Math.round(a.timestamp / (1000 * 60))
      t[minutes] = t[minutes] || 0
      t[minutes]++
      return t
    }, { })

    const failedRequests = profiles.filter(p => p.state === 'error').reduce((t, a) => {
      const minutes = Math.round(a.timestamp / (1000 * 60))
      t[minutes] = t[minutes] || 0
      t[minutes]++
      return t
    }, { })

    return <Line
      data={{
        datasets: [{
          label: 'successfull requests',
          borderColor: 'green',
          data: Object.keys(successfullRequests).map(r => ({
            x: new Date(r * 1000 * 60),
            y: successfullRequests[r]
          }))
        }, {
          label: 'failed request',
          borderColor: 'red',
          data: Object.keys(failedRequests).map(r => ({
            x: new Date(r * 1000 * 60),
            y: failedRequests[r]
          }))
        }]
      }}
      options={{
        scales: {
          xAxes: [{
            type: 'time'
          }]
        }
      }}
    />
  }

  renderRequestsDurationsChart (profiles) {
    return (
      <Line
        data={{
          datasets: [{
            label: 'duration in seconds',
            borderColor: 'green',
            data: profiles.map(p => ({
              x: p.timestamp,
              y: (p.finishedOn - p.timestamp) / 1000,
              name: p.template.name
            }))
          }]
        }}
        options={{
          scales: {
            xAxes: [{
              type: 'time'
            }]
          },
          tooltips: {
            callbacks: {
              label: (item, data) => {
                const v = data.datasets[item.datasetIndex].data[item.index]
                return `Template ${v.name}: ${v.y}s`
              }
            }
          }
        }}
      />
    )
  }

  renderCPUChart (monitoring) {
    return <Line
      data={{
        datasets: monitoring.map(m => ({
          ...m,
          data: m.data.map((d) => ({
            y: d.cpu,
            x: d.timestamp
          }))
        }))
      }}
      options={{
        scales: {
          xAxes: [{
            type: 'time'
          }]
        }
      }} />
  }

  renderMemoryChart (monitoring) {
    return <Line
      data={{
        datasets: monitoring.map(m => ({
          ...m,
          data: m.data.map((d) => ({
            y: d.freemem,
            x: d.timestamp
          }))
        }))
      }}
      options={{
        scales: {
          xAxes: [{
            type: 'time'
          }]
        }
      }} />
  }

  render () {
    const { templates, profiles, monitoring } = this.state
    const { openTab } = this.props

    return (
      <div className='block custom-editor' style={{ overflow: 'auto', minHeight: 0, height: 'auto' }}>
        <div>
          Quick actions:
          <button className='button confirmation' onClick={() => modalHandler.open(NewTemplateModal)}>Create template</button>
          <button className='button confirmation' onClick={() => openTab({ key: 'ProfilerPage', editorComponentKey: 'profiler', title: 'Profiler' })}>Open profiler</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'row' }}>
          <div style={{ flex: '50%' }}>
            <h2>server CPU</h2>
            {this.renderCPUChart(monitoring)}
          </div>
          <div style={{ flex: '50%' }}>
            <h2>server free memory</h2>
            {this.renderMemoryChart(monitoring)}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'row' }}>
          <div style={{ flex: '50%' }}>
            <h2>Render requests status</h2>
            {this.renderRequestsCountChart(profiles)}
          </div>
          <div style={{ flex: '50%' }}>
            <h2>Render requests durations</h2>
            {this.renderRequestsDurationsChart(profiles)}
          </div>

        </div>

        <h2>Last edited templates</h2>

        <div>
          <table className='table'>
            <thead>
              <tr>
                <th>name</th>
                <th>recipe</th>
                <th>last modified</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t._id} onClick={() => openTab({ _id: t._id })}>
                  <td className='selection'>{t.path}</td>
                  <td>{t.recipe}</td>
                  <td>{t.modificationDate.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {this.renderProfiles(profiles)}
      </div>
    )
  }
}

export default connect((state) => ({
  activeTabKey: state.editor.activeTabKey,
  resolveEntityPath: (...params) => entitiesSelectors.resolveEntityPath(state, ...params),
  getByShortid: (...params) => entitiesSelectors.getByShortid(state, ...params)
}), { ...actions }, undefined, { forwardRef: true })(Startup)
