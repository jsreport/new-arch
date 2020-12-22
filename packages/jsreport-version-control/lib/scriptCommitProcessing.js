const Promise = require('bluebird')
const { applyPatches, createPatch } = require('./patches')
const { serialize, deepEqual } = require('./customUtils')

module.exports = async function scriptCommitProcessing (inputs, callbackAsync) {
  const { commitMessage, versions, currentEntities, documentModel, diffLimit } = inputs

  try {
    const newCommit = { message: commitMessage, creationDate: new Date(), changes: [] }
    const lastState = applyPatches(versions, documentModel)

    newCommit.changes = await Promise.reduce(lastState, async (res, s) => {
      const entity = currentEntities[s.entitySet].find((e) => e._id === s.entityId)
      let entityPublicKey

      if (!entity) {
        entityPublicKey = documentModel.entitySets[s.entitySet].entityTypePublicKey

        // entity is not in the new state, it was removed
        return res.concat({
          operation: 'remove',
          entitySet: s.entitySet,
          entityId: s.entityId,
          __local: {
            [entityPublicKey]: s.entity[entityPublicKey],
            folder: s.entity.folder
          }
        })
      }

      // entity is equal so it was not modified, don't adding change
      if (deepEqual(entity, s.entity)) {
        return res
      }

      return res.concat({
        operation: 'update',
        path: entity.__entityPath,
        entitySet: s.entitySet,
        entityId: s.entityId,
        serializedPatch: serialize(createPatch({
          name: s.path,
          oldEntity: s.entity,
          newEntity: entity,
          entitySet: s.entitySet,
          documentModel,
          diffLimit
        }))
      })
    }, [])

    // the entities that exist in store and are not in the last state gets insert change operation
    await Promise.each(Object.keys(currentEntities), (es) => {
      return Promise.each(currentEntities[es], async (e) => {
        if (!lastState.find((s) => s.entityId === e._id && s.entitySet === es)) {
          newCommit.changes.push({
            operation: 'insert',
            path: e.__entityPath,
            entitySet: es,
            entityId: e._id,
            serializedDoc: serialize(e)
          })
        }
      })
    })

    return {
      commit: newCommit,
      localFolders: lastState.filter((r) => r.entitySet === 'folders').map((r) => {
        return {
          name: r.entity.name,
          shortid: r.entity.shortid,
          folder: r.entity.folder
        }
      })
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
