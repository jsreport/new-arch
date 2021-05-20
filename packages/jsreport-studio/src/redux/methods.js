import { clearPreview, preview, updatePreview } from './editor/actions'
import { getById, getByShortid, resolveEntityPath as resolveEPath } from './entities/selectors'
import { getValueByKey } from './settings/selectors'

let store

const methods = {
  getEntityById (id, shouldThrow = true) {
    return getById(store.getState(), id, shouldThrow)
  },
  getEntityByShortid (shortid, shouldThrow = true) {
    return getByShortid(store.getState(), shortid, shouldThrow)
  },
  resolveEntityPath (entity) {
    return resolveEPath(store.getState(), entity)
  },
  getSettingsByKey (key, shouldThrow = true) {
    return getValueByKey(store.getState(), key, shouldThrow)
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
