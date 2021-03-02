import { Component } from 'react'
import styles from './ProfilerErrorModal.css'

class ProfilerErrorModal extends Component {
  render () {
    const { close, options } = this.props
    const { error } = options

    return (
      <div>
        <h3>Error details</h3>
        <div className={`form-group ${styles.errorContainer}`}>
          <pre className={styles.errorMessage}>
            {error.message}
          </pre>
          <pre className={styles.errorStack}>
            {error.stack}
          </pre>
        </div>
        <div className='button-bar'>
          <button className='button confirmation' onClick={() => close()}>Ok</button>
        </div>
      </div>
    )
  }
}

export default ProfilerErrorModal
