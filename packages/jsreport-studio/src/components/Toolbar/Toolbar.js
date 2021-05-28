/* TODO import PropTypes from 'prop-types' */
import React, { Component, Fragment } from 'react'
import { connect } from 'react-redux'
import Popup from '../common/Popup'
import EntityFuzzyFinderModal from '../Modals/EntityFuzzyFinderModal'
import { createGetCanRunSelector, createGetActiveTabSelector, createGetActiveTabWithEntitySelector, createGetCanSaveSelector, createGetCanSaveAllSelector } from '../../redux/editor/selectors'
import { actions as editorActions } from '../../redux/editor'
import { openModal, isModalOpen } from '../../helpers/openModal'
import runLastActiveTemplate from '../../helpers/runLastActiveTemplate'
import openStartup from '../../helpers/openStartup'
import resolveUrl from '../../helpers/resolveUrl'
import { toolbarComponents, toolbarVisibilityResolver, extensions } from '../../lib/configuration'
import style from './Toolbar.css'
import logo from './js-logo.png'

const isMac = () => window.navigator.platform.toUpperCase().indexOf('MAC') >= 0

class Toolbar extends Component {
  /* TODO
  static propTypes = {
    openStartup: PropTypes.func.isRequired,
    onUpdate: PropTypes.func.isRequired,
    onRun: PropTypes.func.isRequired,
    canRun: PropTypes.bool.isRequired,
    onSave: PropTypes.func.isRequired,
    canSave: PropTypes.bool.isRequired,
    onSaveAll: PropTypes.func.isRequired,
    canSaveAll: PropTypes.bool.isRequired,
    isPending: PropTypes.bool.isRequired,
    activeTab: PropTypes.object
  }
  */

  constructor () {
    super()
    this.state = {}
    this.handleUpdate = this.handleUpdate.bind(this)
    this.handleRun = this.handleRun.bind(this)
    this.handleShortcut = this.handleShortcut.bind(this)
    this.handleEarlyShortcut = this.handleEarlyShortcut.bind(this)
    this.handleRunMenuTrigger = this.handleRunMenuTrigger.bind(this)
    this.handleSettingsMenuTrigger = this.handleSettingsMenuTrigger.bind(this)
    this.handleSave = this.handleSave.bind(this)

    this.runMenuTriggerRef = React.createRef()
    this.runMenuContainerRef = React.createRef()
    this.settingsMenuTriggerRef = React.createRef()
    this.settingsMenuContainerRef = React.createRef()
  }

  componentDidMount () {
    window.addEventListener('keydown', this.handleShortcut)
    window.addEventListener('keydown', this.handleEarlyShortcut, true)
  }

  componentWillUnmount () {
    window.removeEventListener('keydown', this.handleShortcut)
    window.addEventListener('keydown', this.handleEarlyShortcut, true)
  }

  handleUpdate (...params) {
    if (this.props.activeTab && this.props.activeTab.readOnly) {
      return
    }

    return this.props.update(...params)
  }

  handleRun (profiling = true) {
    runLastActiveTemplate(profiling)
  }

  // this place captures key events very early (capture phase) so it can work
  // across other contexts that are using keybindings too (like the Ace editor)
  handleEarlyShortcut (e) {
    // ctrl + p -> activates Entity fuzzy finder modal
    if (e.ctrlKey && e.which === 80) {
      if (!isModalOpen()) {
        e.preventDefault()
        e.stopPropagation()

        openModal(EntityFuzzyFinderModal, {})
        return false
      }
    }

    if (e.which === 119 && this.props.canRun) {
      e.preventDefault()
      e.stopPropagation()
      this.handleRun()
      return false
    }
  }

  handleShortcut (e) {
    if (
      (e.ctrlKey && e.shiftKey && e.which === 83) ||
      // handles CMD + SHIFT + S on Mac
      (isMac() && e.metaKey && e.shiftKey && e.which === 83)
    ) {
      e.preventDefault()

      if (this.props.canSaveAll && toolbarVisibilityResolver('SaveAll')) {
        this.handleSave(this.props.saveAll)
        return false
      }
    }

    if (
      (e.ctrlKey && e.which === 83) ||
      // handles CMD + S on Mac
      (isMac() && e.metaKey && e.which === 83)
    ) {
      e.preventDefault()

      if (this.props.canSave && toolbarVisibilityResolver('SaveAll')) {
        this.handleSave(this.props.save)
        return false
      }
    }
  }

  async handleSave (onSave) {
    if (this.state.saving) {
      return
    }

    try {
      this.setState({
        saving: true
      })

      await onSave()
    } finally {
      this.setState({
        saving: false
      })
    }
  }

  handleRunMenuTrigger (e) {
    e.stopPropagation()

    if (
      this.runMenuTriggerRef.current == null ||
      this.runMenuContainerRef.current == null
    ) {
      return
    }

    if (
      this.runMenuTriggerRef.current.contains(e.target) &&
      !this.runMenuContainerRef.current.contains(e.target)
    ) {
      this.setState((prevState) => ({
        expandedRun: !prevState.expandedRun
      }))
    }
  }

  handleSettingsMenuTrigger (e) {
    e.stopPropagation()

    if (
      this.settingsMenuTriggerRef.current == null ||
      this.settingsMenuContainerRef.current == null
    ) {
      return
    }

    if (
      this.settingsMenuTriggerRef.current.contains(e.target) &&
      !this.settingsMenuContainerRef.current.contains(e.target)
    ) {
      this.setState((prevState) => ({
        expandedSettings: !prevState.expandedSettings
      }))
    }
  }

  renderButton (onClick, enabled, text, imageClass, tooltip) {
    if (toolbarVisibilityResolver(text) === false) {
      return false
    }

    return (
      <div
        title={tooltip}
        className={'toolbar-button ' + ' ' + (enabled ? '' : 'disabled')}
        onClick={enabled ? onClick : () => {}}
      >
        <i className={imageClass} /><span>{text}</span>
      </div>
    )
  }

  renderRun () {
    const { canRun } = this.props

    return (
      <div
        ref={this.runMenuTriggerRef}
        title='Preview report in the right pane (F8)'
        className={'toolbar-button ' + (canRun ? '' : 'disabled')}
        onClick={() => {
          if (!canRun) {
            return
          }

          this.handleRun()
          this.setState({ expandedRun: false })
        }}
      >
        <i className='fa fa-play' />Run
        <span
          className={style.runCaret}
          onClick={this.handleRunMenuTrigger}
        />
        <Popup
          ref={this.runMenuContainerRef}
          open={this.state.expandedRun}
          position={{ top: undefined, right: undefined }}
          onRequestClose={() => this.setState({ expandedRun: false })}
        >
          {(itemProps) => {
            if (!itemProps.open) {
              return
            }

            return this.renderButton((e) => {
              e.stopPropagation()
              itemProps.closeMenu()
              this.handleRun(false)
            }, canRun, 'Run without profiling', 'fa fa-play-circle', 'Preview in new tab')
          }}
        </Popup>
      </div>
    )
  }

  renderToolbarComponents (position, onCloseMenu) {
    return toolbarComponents[position].map((p, i) => React.createElement(p, {
      key: i,
      tab: this.props.activeTabWithEntity,
      closeMenu: position === 'settings' || position === 'settingsBottom' ? onCloseMenu : undefined,
      onUpdate: this.handleUpdate,
      canRun: this.props.canRun,
      canSaveAll: this.props.canSaveAll
    }))
  }

  renderSettings () {
    if (toolbarVisibilityResolver('settings') === false) {
      return false
    }

    return (
      <div
        ref={this.settingsMenuTriggerRef}
        className='toolbar-button'
        onClick={this.handleSettingsMenuTrigger}
      >
        <i className='fa fa-cog' />
        <Popup
          ref={this.settingsMenuContainerRef}
          open={this.state.expandedSettings}
          position={{ top: undefined }}
          onRequestClose={() => this.setState({ expandedSettings: false })}
        >
          {(itemProps) => {
            if (!itemProps.open) {
              return
            }

            return (
              // eslint-disable-next-line
              <Fragment>
                {this.renderToolbarComponents('settings', itemProps.closeMenu)}
                {toolbarComponents.settingsBottom.length ? <hr /> : ''}
                {this.renderToolbarComponents('settingsBottom', itemProps.closeMenu)}
              </Fragment>
            )
          }}
        </Popup>
      </div>
    )
  }

  render () {
    const metaKey = isMac() ? 'CMD' : 'CTRL'
    const { canSave, canSaveAll, save, saveAll, isPending } = this.props

    return (
      <div className={style.toolbar}>
        <div className={style.logo} onClick={() => openStartup()}>
          <img
            src={extensions.studio.options.customLogo === true ? resolveUrl(`/studio/assets/custom-logo?${extensions.studio.options.serverStartupHash}`) : logo}
            style={{ width: 'auto', height: 'auto', maxWidth: '100%', maxHeight: '100%', display: 'inline-block' }}
          />
        </div>
        {this.renderRun()}
        {this.renderButton(() => this.handleSave(save), canSave, 'Save', 'fa fa-floppy-o', `Save current tab (${metaKey}+S)`)}
        {this.renderButton(() => this.handleSave(saveAll), canSaveAll, 'SaveAll', 'fa fa-floppy-o', `Save all tabs (${metaKey}+SHIFT+S`)}
        {this.renderToolbarComponents('left')}
        <div className={style.spinner}>
          {isPending ? <i className='fa fa-spinner fa-spin fa-fw' /> : ''}
        </div>
        {this.renderToolbarComponents('right')}
        {this.renderSettings()}
      </div>
    )
  }
}

function makeMapStateToProps () {
  const getActiveTab = createGetActiveTabSelector()
  const getActiveTabWithEntity = createGetActiveTabWithEntitySelector()
  const getCanRun = createGetCanRunSelector()
  const getCanSave = createGetCanSaveSelector()
  const getCanSaveAll = createGetCanSaveAllSelector()

  return (state) => ({
    isPending: state.progress.isPending,
    canRun: getCanRun(state),
    canSave: getCanSave(state),
    canSaveAll: getCanSaveAll(state),
    activeTab: getActiveTab(state),
    activeTabWithEntity: getActiveTabWithEntity(state)
  })
}

export default connect(makeMapStateToProps, {
  save: editorActions.save,
  saveAll: editorActions.saveAll,
  update: editorActions.update
})(Toolbar)
