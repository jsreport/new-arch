import React, { Component } from 'react'
import style from './EntityTreeBox.css'

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
