/* import PropTypes from 'prop-types' */
import React, { Component } from 'react'
import style from './Properties.css'
import { propertiesComponents } from '../../lib/configuration.js'

class Properties extends Component {
  /* TODO
  static propTypes = {
    entity: PropTypes.object,
    entities: PropTypes.object,
    onChange: PropTypes.func.isRequired
  }
  */

  constructor () {
    super()
    this.state = {}
  }

  toggle (key) {
    this.setState({ [key]: !this.state[key] })
  }

  renderTitle (title, entity, entities) {
    if (typeof title === 'string') {
      return <span>{title}</span>
    }

    return title(entity, entities)
  }

  renderOne (def, key, entity, entities, onChange) {
    return !def.shouldDisplay(entity)
      ? <div key={key} />
      : (
        <div key={key} className={style.propertyBox}>
          <div
            className={style.propertyTitle + ' ' + (this.state[key] ? style.expanded : '')}
            onClick={() => this.toggle(key)}
          >{this.renderTitle(def.title, entity, entities)}
          </div>
          <div className={style.propertyContentBox + ' ' + (this.state[key] ? style.expanded : '')}>
            {React.createElement(def.component, {
              key: key,
              entity: entity,
              entities: entities,
              onChange: onChange
            })}
          </div>
        </div>
        )
  }

  renderProperties () {
    const { entity, onChange, entities } = this.props

    return (
      <div className={style.propertiesNodes}>
        <div>
          <div className='form-group'>
            <label>name</label>
            <input
              type='text' value={entity.name || ''}
              onChange={(v) => onChange({ _id: entity._id, name: v.target.value })}
            />
          </div>
        </div>
        {propertiesComponents.map((p, i) => this.renderOne(p, i, entity, entities, onChange))}
      </div>
    )
  }

  render () {
    const { entity } = this.props

    return (
      <div className={style.propertiesPanel}>
        <div className={style.title}>Properties</div>
        <div className={style.propertiesContainer}>
          {entity ? this.renderProperties(entity) : ''}
        </div>
      </div>
    )
  }
}

export default Properties
