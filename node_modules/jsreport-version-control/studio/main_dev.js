import Studio from 'jsreport-studio'
import React, { Component } from 'react'
import HistoryEditor from './HistoryEditor'
import LocalChangesEditor from './LocalChangesEditor'
import style from './VersionControl.scss'

Studio.initializeListeners.push(async () => {
  if (Studio.authentication && !Studio.authentication.user.isAdmin) {
    return
  }

  Studio.addEditorComponent('versionControlHistory', HistoryEditor)
  Studio.addEditorComponent('versionControlLocalChanges', LocalChangesEditor)

  class VCToolbar extends Component {
    constructor () {
      super()
      this.state = { }
      this.tryHide = this.tryHide.bind(this)
    }

    componentDidMount () {
      window.addEventListener('click', this.tryHide)
    }

    componentWillUnmount () {
      window.removeEventListener('click', this.tryHide)
    }

    tryHide () {
      this.setState({ expandedToolbar: false })
    }

    openHistory (e) {
      e.stopPropagation()
      this.tryHide()
      Studio.openTab({ key: 'versionControlHistory', editorComponentKey: 'versionControlHistory', title: 'Commits history' })
    }

    openLocalChanges (e) {
      e.stopPropagation()
      this.tryHide()
      Studio.openTab({ key: 'versionControlLocalChanges', editorComponentKey: 'versionControlLocalChanges', title: 'Uncommited changes' })
    }

    render () {
      return (<div className='toolbar-button' onClick={(e) => this.openLocalChanges(e)}>
        <i className='fa fa-history ' />Commit
        <span className={style.runCaret} onClick={(e) => { e.stopPropagation(); this.setState({ expandedToolbar: !this.state.expandedToolbar }) }} />
        <div className={style.runPopup} style={{ display: this.state.expandedToolbar ? 'block' : 'none' }}>
          <div title='History' className='toolbar-button' onClick={(e) => this.openHistory(e)}>
            <i className='fa fa-history' /><span>History</span>
          </div>
        </div>
      </div>)
    }
  }

  Studio.addToolbarComponent((props) => <VCToolbar />)
})
