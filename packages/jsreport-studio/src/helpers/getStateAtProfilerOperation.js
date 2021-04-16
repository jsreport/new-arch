import { applyPatch } from 'diff'

function getStateAtProfilerOperation (operations, operationId, completed = false, cache = {}) {
  let state

  const operation = operations.find((op) => op.id === operationId)

  if (operation == null) {
    throw new Error(`Operation with id "${operationId}" not found, not able to get state`)
  }

  let previousOperation

  if (operation.previousOperationId != null) {
    previousOperation = operations.find((op) => op.id === operation.previousOperationId)

    if (previousOperation == null) {
      throw new Error(`Previous operation with id "${operation.previousOperationId}" not found`)
    }
  }

  let previousOperationWithState

  if (previousOperation != null) {
    const cacheItem = cache[previousOperation.id]

    if (
      cacheItem == null ||
      (previousOperation.type !== 'render' && cacheItem.completedReqState == null)
    ) {
      previousOperationWithState = getStateAtProfilerOperation(operations, previousOperation.id, previousOperation.type !== 'render', cache)
    } else {
      previousOperationWithState = cacheItem
    }
  }

  const reqState = applyPatch(previousOperationWithState != null ? (
    previousOperationWithState.type === 'render' ? previousOperationWithState.reqState : previousOperationWithState.completedReqState
  ) : '', operation.req.diff)

  let resState

  if (previousOperationWithState != null) {
    if (operation.res.content != null) {
      if (operation.res.content.encoding === 'diff') {
        resState = applyPatch(previousOperationWithState.type === 'render' ? previousOperationWithState.resState : previousOperationWithState.completedResState, operation.res.content.content)
      } else {
        resState = operation.res.content.content
      }
    } else {
      resState = previousOperationWithState.type === 'render' ? previousOperationWithState.resState : previousOperationWithState.completedResState
    }
  } else {
    resState = ''
  }

  const resMetaState = applyPatch(previousOperationWithState != null ? (
    previousOperationWithState.type === 'render' ? previousOperationWithState.resMetaState : previousOperationWithState.completedResMetaState
  ) : '', operation.res.meta.diff)

  state = {
    ...operation,
    reqState,
    resState,
    resMetaState
  }

  cache[operation.id] = state

  if (completed) {
    const completedPreviousOperation = operations.find((op) => op.id === operation.completedPreviousOperationId)

    if (completedPreviousOperation == null) {
      throw new Error(`Previous operation with id "${operation.completedPreviousOperationId}" not found`)
    }

    const isRenderOrSame = completedPreviousOperation.type === 'render' || operation.id === completedPreviousOperation.id
    let completedPreviousOperationWithState

    if (operation.id === completedPreviousOperation.id) {
      completedPreviousOperationWithState = state
    } else if (completedPreviousOperation.type === 'render') {
      completedPreviousOperationWithState = cache[completedPreviousOperation.id] != null ? cache[completedPreviousOperation.id] : getStateAtProfilerOperation(operations, completedPreviousOperation.id, false, cache)
    } else {
      const cacheItem = cache[completedPreviousOperation.id]

      if (
        cacheItem == null ||
        (!isRenderOrSame && cacheItem.completedReqState == null)
      ) {
        completedPreviousOperationWithState = getStateAtProfilerOperation(operations, completedPreviousOperation.id, true, cache)
      } else {
        completedPreviousOperationWithState = cacheItem
      }
    }

    const completedReqState = applyPatch(
      isRenderOrSame ? (
        completedPreviousOperationWithState.reqState
      ) : completedPreviousOperationWithState.completed ? completedPreviousOperationWithState.completedReqState : completedPreviousOperationWithState.reqState,
      operation.completedReq.diff
    )

    let completedResState

    if (operation.completedRes.content != null) {
      if (operation.completedRes.content.encoding === 'diff') {
        completedResState = applyPatch(
          isRenderOrSame ? (
            completedPreviousOperationWithState.resState
          ) : completedPreviousOperationWithState.completed ? completedPreviousOperationWithState.completedResState : completedPreviousOperationWithState.resState,
          operation.completedRes.content.content
        )
      } else {
        completedResState = operation.completedRes.content.content
      }
    } else {
      completedResState = completedPreviousOperationWithState.completed ? completedPreviousOperationWithState.completedResState : completedPreviousOperationWithState.resState
    }

    const completedResMetaState = applyPatch(
      isRenderOrSame ? (
        completedPreviousOperationWithState.resMetaState
      ) : completedPreviousOperationWithState.completed ? completedPreviousOperationWithState.completedResMetaState : completedPreviousOperationWithState.resMetaState,
      operation.completedRes.meta.diff
    )

    state = {
      ...state,
      completedReqState,
      completedResState,
      completedResMetaState
    }

    cache[operation.id] = state
  }

  return state
}

export default getStateAtProfilerOperation
