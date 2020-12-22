import { entitySets } from '../../lib/configuration.js'

const getEntityName = (e) => entitySets[e.__entitySet].nameAttribute ? e[entitySets[e.__entitySet].nameAttribute] : e.name

export const getById = (state, id, shouldThrow = true) => {
  if (!state.entities[id] && shouldThrow) {
    throw new Error(`Unable to find entity with id ${id}`)
  }

  return state.entities[id]
}

export const getByShortid = (state, shortid, shouldThrow = true) => {
  const entities = getAll(state).filter((e) => e.shortid === shortid)

  if (!entities.length && shouldThrow) {
    throw new Error(`Unable to find entity with shortid ${shortid}`)
  }

  return entities.length ? entities[0] : null
}

export const getReferences = (state) => {
  let result = {}
  getAll(state).forEach((entity) => {
    result[entity.__entitySet] = result[entity.__entitySet] || []
    result[entity.__entitySet].push(entity)
  })

  Object.keys(result).forEach((k) => {
    result[k] = result[k].sort((a, b) => getEntityName(a).toLowerCase().localeCompare(getEntityName(b).toLowerCase()))
  })

  Object.keys(entitySets).forEach((e) => (result[e] = result[e] || []))

  return result
}

export const getNormalizedEntities = (state) => {
  return getAll(state).map((entity) => {
    return {
      _id: entity._id,
      name: getEntityName(entity),
      path: resolveEntityPath(state, entity),
      entity: entity
    }
  })
}

export const resolveEntityPath = (state, { _id }) => {
  let entity = state.entities[_id]

  if (!entity) {
    return
  }

  const pathFragments = [getEntityName(entity)]

  while (entity.folder) {
    const folder = getByShortid(state, entity.folder.shortid)
    pathFragments.push(folder.name)
    entity = folder
  }

  return '/' + pathFragments.reverse().join('/')
}

export const getAll = (state) => Object.keys(state.entities).map((e) => state.entities[e])
