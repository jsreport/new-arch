import React, { Component } from 'react'
import { connect } from 'react-redux'
import { actions } from '../../../redux/editor'
import storeMethods from '../../../redux/methods'
import EntityTreeSelectionModal from '../../Modals/EntityTreeSelectionModal'
import { openModal } from '../../../helpers/openModal'
import styles from './EntityRefSelect.css'

const SelectInput = ({ textToShow, entity, handleOpenTree, openTab, disabled }) => (
  <div
    className={styles.selectInput} onClick={() => !disabled && handleOpenTree()}
    style={{ opacity: disabled ? 0.7 : 1 }}
  >
    <i className='fa fa-pencil-square-o' />
    <span
      title={textToShow}
      className={`${styles.nameLabel} ${textToShow ? styles.link : ''}`}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()

        if (entity) {
          openTab(entity)
        } else {
          if (!disabled) {
            handleOpenTree()
          }
        }
      }}
    >
      {textToShow || 'select ...'}
    </span>
  </div>
)

class EntityRefSelect extends Component {
  constructor (props) {
    super(props)

    this.state = {
      showingTreeInline: false
    }

    this.handleOpenTree = this.handleOpenTree.bind(this)
  }

  getPropsForEntityTree () {
    const { onChange } = this.props

    const props = {
      allowNewFolder: this.props.allowNewFolder,
      headingLabel: this.props.headingLabel,
      filter: this.props.filter,
      selectableFilter: this.props.selectableFilter,
      selected: this.props.value,
      multiple: this.props.multiple === true,
      treeStyle: this.props.treeStyle,
      onSave: (selected) => onChange(selected)
    }

    return props
  }

  handleOpenTree () {
    const { noModal = false } = this.props

    if (noModal === true) {
      this.setState({
        showingTreeInline: true
      })
    } else {
      openModal(EntityTreeSelectionModal, this.getPropsForEntityTree())
    }
  }

  render () {
    const {
      value,
      multiple = false,
      disabled = false
    } = this.props

    const { showingTreeInline } = this.state

    let currentValue

    if (value != null) {
      currentValue = multiple === true ? value : [value]
    }

    if (!multiple) {
      let textToShow
      let entity

      if (currentValue != null && currentValue[0] != null) {
        entity = storeMethods.getEntityByShortid(currentValue[0], false)

        if (!entity) {
          textToShow = ''
        } else {
          textToShow = storeMethods.resolveEntityPath(entity)
        }
      } else {
        textToShow = ''
      }

      if (showingTreeInline) {
        return (
          <EntityTreeSelectionModal
            close={() => this.setState({ showingTreeInline: false })}
            options={this.getPropsForEntityTree()}
          />
        )
      }

      return (
        <SelectInput
          textToShow={textToShow}
          // eslint-disable-next-line
          handleOpenTree={this.handleOpenTree}
          entity={entity}
          openTab={this.props.openTab}
          disabled={disabled}
        />
      )
    }

    const items = []

    if (currentValue) {
      currentValue.forEach((eShortid) => {
        const entity = storeMethods.getEntityByShortid(eShortid, false)

        if (!entity) {
          return
        }

        const namePath = storeMethods.resolveEntityPath(entity)

        items.push(
          <li key={namePath} title={namePath} onClick={() => this.props.openTab(entity)}>
            <span className={styles.nameLabel}>{namePath}</span>
          </li>
        )
      })
    }

    return (
      <div className={styles.select} style={{ opacity: disabled ? 0.7 : 1 }}>
        {showingTreeInline
          ? (
            <EntityTreeSelectionModal
              close={() => this.setState({ showingTreeInline: false })}
              options={this.getPropsForEntityTree()}
            />
            )
          : (
              [
                <SelectInput
                  key='selectInput'
                  // eslint-disable-next-line
                  handleOpenTree={this.handleOpenTree}
                  openTab={this.props.openTab}
                />,
                <ul key='selectedItems' tabIndex='0'>
                  {items}
                </ul>
              ]
            )}
      </div>
    )
  }
}

export default connect(undefined, { openTab: actions.openTab })(EntityRefSelect)
