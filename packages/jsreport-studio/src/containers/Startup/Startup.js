import React, { Component } from 'react'
import { connect } from 'react-redux'
import { actions } from '../../redux/editor'
import { selectors as entitiesSelectors } from '../../redux/entities'
import api from '../../helpers/api.js'
import { previewFrameChangeHandler } from '../../lib/configuration.js'

class Startup extends Component {
  constructor () {
    super()
    this.state = { templates: [], profiles: [] }
  }

  async onTabActive () {
    if (this._loading) {
      return
    }
    this._loading = true

    try {
      await this.loadLastModifiedTemplates()
      await this.loadProfiles()
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
    const response = await api.get('/odata/profiles')

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

  shouldComponentUpdate (props) {
    return props.activeTabKey === 'StartupPage'
  }

  async openProfile (p) {
    const ab = await api.get(`/api/profile/${p._id}/content`, { responseType: 'arraybuffer' })
    const str = String.fromCharCode.apply(null, new Uint8Array(ab))

    return previewFrameChangeHandler('data:text/html;charset=utf-8,' + encodeURI(str))
  }

  renderProfiles (profiles) {
    const { openTab } = this.props

    return (
      <div>
        <h2>Last requests' profiles</h2>

        <div>
          <table className='table'>
            <thead>
              <tr>
                <th>template</th>
                <th>started</th>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  render () {
    const { templates, profiles } = this.state
    const { openTab } = this.props

    return (
      <div className='block custom-editor' style={{ overflow: 'auto', minHeight: 0, height: 'auto' }}>
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
