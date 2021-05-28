import React, { Fragment, Component } from 'react'
import { connect } from 'react-redux'
import _omit from 'lodash/omit'
import TabPane from './TabPane'
import { createGetActiveTabSelector, createGetTabWithEntitiesSelector } from '../../redux/editor/selectors'
import { groupedUpdate } from '../../redux/editor/actions'
import { editorComponents, entityEditorComponentKeyResolvers } from '../../lib/configuration'

class EditorTabs extends Component {
  constructor (props) {
    super(props)

    this.onUpdate = this.onUpdate.bind(this)
  }

  componentDidMount () {
    this.checkActiveTabAndFireHook(this.props.activeTabKey)
  }

  componentDidUpdate (prevProps) {
    if (prevProps.activeTabKey !== this.props.activeTabKey) {
      this.checkActiveTabAndFireHook(this.props.activeTabKey)
    }
  }

  onUpdate (entity) {
    const { activeTab, groupedUpdate } = this.props

    if (activeTab && activeTab.readOnly) {
      return
    }

    return groupedUpdate(entity)
  }

  checkActiveTabAndFireHook (activeTabKey) {
    if (activeTabKey == null) {
      return
    }

    const componentTabRef = this[`${activeTabKey}Ref`]

    if (!componentTabRef) {
      return
    }

    if (typeof componentTabRef.onTabActive === 'function') {
      componentTabRef.onTabActive()
    }
  }

  renderEntityTab (t, onUpdate) {
    let editorComponentResult

    if (t.tab.editorComponentKey != null) {
      editorComponentResult = { key: t.tab.editorComponentKey }
    } else {
      entityEditorComponentKeyResolvers.some((componentKeyResolverFn) => {
        const componentKey = componentKeyResolverFn(t.entity)
        let found = false

        if (componentKey) {
          editorComponentResult = componentKey
          found = true
        }

        return found
      })

      if (editorComponentResult == null) {
        editorComponentResult = { key: t.entity.__entitySet }
      }
    }

    let entity = t.entity

    if (Object.prototype.hasOwnProperty.call(editorComponentResult, 'entity')) {
      entity = editorComponentResult.entity
    }

    const editorProps = {
      ...(typeof t.tab.getProps === 'function' ? t.tab.getProps() : {}),
      ...editorComponentResult.props,
      entity,
      tab: _omit(t.tab, ['getEntity', 'getProps', 'update']),
      ref: (el) => { this[`${t.tab.key}Ref`] = el },
      onUpdate: (o) => {
        if (typeof t.tab.update === 'function') {
          return t.tab.update(o, onUpdate)
        } else {
          return onUpdate(o)
        }
      }
    }

    return (
      <Fragment key={t.tab.key}>
        {React.createElement(editorComponents[editorComponentResult.key], editorProps)}
      </Fragment>
    )
  }

  render () {
    const { activeTabKey, tabs } = this.props

    return (
      <TabPane
        activeTabKey={activeTabKey}
      >
        {tabs.map((t) =>
          this.renderEntityTab(t, this.onUpdate)
        )}
      </TabPane>
    )
  }
}

function makeMapStateToProps () {
  const getActiveTab = createGetActiveTabSelector()
  const getTabWithEntities = createGetTabWithEntitiesSelector()

  return (state) => ({
    activeTab: getActiveTab(state),
    activeTabKey: state.editor.activeTabKey,
    tabs: getTabWithEntities(state)
  })
}

export default connect(makeMapStateToProps, {
  groupedUpdate
})(EditorTabs)
