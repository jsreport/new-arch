import React, { Component } from 'react'

class TabContent extends Component {
  shouldComponentUpdate (nextProps) {
    return this.props.active || nextProps.active
  }

  render () {
    const { active } = this.props

    return (
      <div className='block' style={{ display: active ? 'flex' : 'none' }}>
        {this.props.children}
      </div>
    )
  }
}

export default TabContent
