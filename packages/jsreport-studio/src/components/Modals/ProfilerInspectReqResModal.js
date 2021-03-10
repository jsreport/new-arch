import { Component } from 'react'
import styles from './ProfilerInspectReqResModal.css'

class ProfilerInspectReqResModal extends Component {
  render () {
    const { close, options } = this.props
    const { title, content } = options

    return (
      <div>
        <h3>{title}</h3>
        <div className={`form-group ${styles.container}`}>
          <pre className={styles.content}>
            {content}
          </pre>
        </div>
        <div className='button-bar'>
          <button className='button confirmation' onClick={() => close()}>Ok</button>
        </div>
      </div>
    )
  }
}

export default ProfilerInspectReqResModal
