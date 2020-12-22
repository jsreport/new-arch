const Promise = require('bluebird')
const { createPatch, applyPatches } = require('./patches')
const sortVersions = require('./sortVersions')
const { parse } = require('./customUtils')

module.exports = async function scriptDiffProcessing (inputs, callback) {
  const { commitToDiff, versions, documentModel, diffLimit } = inputs

  try {
    const versionsToPatch = sortVersions(versions, 'ASC')
    const previousState = applyPatches(versionsToPatch.slice(0, -1), documentModel)
    const commitState = applyPatches(versionsToPatch, documentModel)

    // This custom implementation stores whole entity patch in single object
    // with additional information like entity id. This is something git based implementation
    // cannot simply provide because it works only with files. There are no document properties
    // or entity ids availible in git. I wanted to keep the API same for both, so we return here
    // document properties as extra items (files) in array and omit some information
    const diff = await Promise.reduce(commitToDiff.changes, async (res, c) => {
      let state

      const change = {
        path: c.path,
        operation: c.operation,
        entitySet: c.entitySet
      }

      let patch

      if (c.operation === 'remove') {
        const previousEntity = previousState.find((s) => s.entityId === c.entityId)

        patch = createPatch({
          name: c.path,
          oldEntity: previousEntity.entity,
          newEntity: {},
          entitySet: c.entitySet,
          documentModel,
          diffLimit,
          context: Number.MAX_VALUE,
          bufferEncoding: 'utf8'
        })
      }

      if (c.operation === 'insert') {
        const doc = parse(c.serializedDoc)

        state = doc

        patch = createPatch({
          name: c.path,
          oldEntity: {},
          newEntity: doc,
          entitySet: c.entitySet,
          documentModel,
          diffLimit,
          context: Number.MAX_VALUE,
          bufferEncoding: 'utf8'
        })
      }

      if (c.operation === 'update') {
        const previousEntity = previousState.find((s) => s.entityId === c.entityId)
        const afterEntity = commitState.find((s) => s.entityId === c.entityId)

        state = afterEntity.entity

        patch = createPatch({
          name: c.path,
          oldEntity: previousEntity.entity,
          newEntity: afterEntity.entity,
          entitySet: c.entitySet,
          documentModel,
          diffLimit,
          context: Number.MAX_VALUE,
          bufferEncoding: 'utf8'
        })
      }

      const entityName = change.path.split('/').slice(-1)[0]

      return res.concat({
        ...change,
        name: entityName,
        state,
        patch: patch.config,
        properties: patch.documentProperties.map((p) => {
          const parts = p.path.split('.')
          const documentPropertyName = parts.slice(-1)[0]

          return {
            ...change,
            name: parts.length === 1 ? entityName : `${entityName}-${documentPropertyName}`,
            path: `${change.path}/${documentPropertyName}`,
            propertyName: p.path,
            patch: p.patch,
            type: p.type
          }
        })
      })
    }, [])

    return {
      diff
    }
  } catch (e) {
    return {
      error: {
        message: e.message,
        stack: e.stack
      }
    }
  }
}
