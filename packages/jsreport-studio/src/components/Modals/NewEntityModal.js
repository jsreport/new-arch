import PropTypes from 'prop-types'
import React, { Component } from 'react'
import { connect } from 'react-redux'
import { actions } from '../../redux/editor'
import api from '../../helpers/api.js'
import { entitySets } from '../../lib/configuration.js'

class NewEntityModal extends Component {
  static propTypes = {
    close: PropTypes.func.isRequired,
    options: PropTypes.object.isRequired
  }

  constructor (props) {
    super(props)

    this.nameInputRef = React.createRef()

    this.state = {
      error: null,
      processing: false
    }
  }

  // the modal component for some reason after open focuses the panel itself
  componentDidMount () {
    setTimeout(() => this.nameInputRef.current.focus(), 0)
  }

  handleKeyPress (e) {
    if (e.key === 'Enter') {
      this.submit(e.target.value)
    }
  }

  async submit (val) {
    if (this.state.processing) {
      return
    }

    const name = val || this.nameInputRef.current.value

    let entity = Object.assign({}, this.props.options.entity)

    if (this.props.options.defaults != null) {
      entity = Object.assign(this.props.options.defaults, entity)
    }

    this.setState({ processing: true })

    try {
      await api.post('/studio/validate-entity-name', {
        data: {
          _id: this.props.options.cloning === true ? undefined : entity._id,
          name: name,
          entitySet: this.props.options.entitySet,
          folderShortid: entity.folder != null ? entity.folder.shortid : null
        }
      })
    } catch (e) {
      this.setState({
        error: e.message,
        processing: false
      })

      return
    }

    this.setState({
      error: null,
      processing: false
    })

    this.props.close()

    this.props.openNewTab({
      entity,
      entitySet: this.props.options.entitySet,
      name
    })
  }

  render () {
    const { error, processing } = this.state
    const { entitySet, initialName } = this.props.options

    return <div>
      <div className='form-group'>
        <label>New {entitySets[entitySet].visibleName}</label>
        <input
          type='text'
          placeholder='name...'
          ref={this.nameInputRef}
          defaultValue={initialName}
          onKeyPress={(e) => this.handleKeyPress(e)}
        />
      </div>
      <div className='form-group'>
        <span style={{ color: 'red', display: error ? 'block' : 'none' }}>{error}</span>
      </div>
      <div className='button-bar'>
        <button className='button confirmation' disabled={processing} onClick={() => this.submit()}>ok</button>
      </div>
    </div>
  }
}

export default connect(
  (state) => ({}),
  { ...actions }
)(NewEntityModal)
