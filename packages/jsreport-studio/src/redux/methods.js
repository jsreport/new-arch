import { getById, getByShortid, resolveEntityPath as resolveEPath } from './entities/selectors'
import { getCanSaveAll } from './editor/selectors'
import { clearPreview, openTab, preview, run, updatePreview } from './editor/actions'
import { start as progressStart, stop as progressStop } from './progress/actions'
import { getValueByKey } from './settings/selectors'

let store

const methods = {
  getEntityById (id, shouldThrow = true) {
    return getById(store.getState().entities, id, shouldThrow)
  },
  getEntityByShortid (shortid, shouldThrow = true) {
    return getByShortid(store.getState().entities, shortid, shouldThrow)
  },
  resolveEntityPath (entity) {
    return resolveEPath(store.getState().entities, entity)
  },
  getSettingsByKey (key, shouldThrow = true) {
    return getValueByKey(store.getState().settings, key, shouldThrow)
  },
  getEditorCanSaveAll () {
    return getCanSaveAll(store.getState().editor.tabs, store.getState().entities)
  },
  openEditorTab (...args) {
    return store.dispatch(openTab(...args))
  },
  progressStart (...args) {
    return store.dispatch(progressStart(...args))
  },
  progressStop (...args) {
    return store.dispatch(progressStop(...args))
  },
  run (...args) {
    return store.dispatch(run(...args))
  },
  preview (...args) {
    return store.dispatch(preview(...args))
  },
  updatePreview (...args) {
    return store.dispatch(updatePreview(...args))
  },
  clearPreview (...args) {
    return store.dispatch(clearPreview(...args))
  }
}

function setStore (s) {
  store = s
}

export { setStore }

export default methods
