import parse from '../../helpers/parseJSON.js'

export const getByKey = (state, key, shouldThrow = true) => {
  const entities = Object.keys(state.settings).map((k) => state.settings[k]).filter((s) => s.key === key)

  if (!entities.length && shouldThrow) {
    throw new Error(`settings with key ${key} was not found`)
  }

  if (!entities.length) {
    return null
  }

  return typeof entities[0].value === 'string'
    ? {
        _id: entities[0]._id,
        key: key,
        value: parse(entities[0].value)
      }
    : entities[0]
}

export const getValueByKey = (state, key, shouldThrow = true) => {
  const entry = getByKey(state, key, shouldThrow)

  if (!entry) {
    return
  }

  return typeof entry.value === 'string' ? parse(entry.value) : entry.value
}

export const getAll = (state) => state
