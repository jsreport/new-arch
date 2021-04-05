import { selectors } from '../entities'
import { editorComponents } from '../../lib/configuration.js'

export const getTabWithEntities = (state) => state.editor.tabs.map((t) => ({
  entity: t.type === 'entity' ? selectors.getById(state, t._id) : (
    typeof t.getEntity === 'function' ? t.getEntity() : null
  ),
  tab: t
}))

export const getActiveTab = (state) => state.editor.activeTabKey ? state.editor.tabs.filter((t) => t.key === state.editor.activeTabKey)[0] : null

export const getActiveEntity = (state) => {
  if (!state.editor.activeTabKey) {
    return null
  }

  const tab = getActiveTab(state)

  if (!tab) {
    return null
  }

  return tab.type === 'entity' ? selectors.getById(state, tab._id, false) : (
    typeof tab.getEntity === 'function' ? tab.getEntity() : null
  )
}

export const getActiveTabWithEntity = (state) => {
  const tab = getActiveTab(state)

  if (!tab || (tab.type !== 'entity' && typeof tab.getEntity !== 'function')) {
    return { tab }
  }

  return {
    tab,
    entity: tab.type === 'entity' ? selectors.getById(state, tab._id) : (
      typeof tab.getEntity === 'function' ? tab.getEntity() : null
    )
  }
}

export const getLastActiveTemplate = (state) => {
  if (!state.editor.lastActiveTemplateKey) {
    return null
  }

  return selectors.getById(state, state.editor.lastActiveTemplateKey)
}

export const canRun = (state) => {
  const activeTab = getActiveTab(state)

  if (activeTab != null) {
    return !!state.editor.lastActiveTemplateKey && activeTab.type === 'entity'
  }

  return !!state.editor.lastActiveTemplateKey
}

export const canRemove = (state) => {
  const entity = getActiveEntity(state)

  return !!entity
}

export const canSave = (state) => {
  const entity = getActiveEntity(state)

  return entity ? !!entity.__isDirty : false
}

export const canSaveAll = (state) => {
  return getTabWithEntities(state).filter((t) => t.entity && t.entity.__isDirty).length > 0
}

export const canReformat = (state) => {
  const tab = getActiveTab(state)

  return (tab && editorComponents[tab.editorComponentKey || tab.entitySet].reformat != null)
}
