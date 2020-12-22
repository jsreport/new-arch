import React, { Component } from 'react'
import style from './EntityTreeBox.scss'

class EntityTreeBox extends Component {
  render () {
    return (
      <div className={style.boxContainer}>
        {this.props.children}
      </div>
    )
  }
}

export default EntityTreeBox
