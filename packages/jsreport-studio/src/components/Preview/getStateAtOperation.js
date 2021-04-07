import { applyPatch } from 'diff'

function getStateAtOperation (operations, operationId, completed = false) {
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
    previousOperationWithState = getStateAtOperation(operations, previousOperation.id, previousOperation.type !== 'render')
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

  if (completed) {
    const completedPreviousOperation = operations.find((op) => op.id === operation.completedPreviousOperationId)

    if (completedPreviousOperation == null) {
      throw new Error(`Previous operation with id "${operation.completedPreviousOperationId}" not found`)
    }

    const isRenderOrSame = completedPreviousOperation.type === 'render' || operation.id === completedPreviousOperation.id
    const completedPreviousOperationWithState = getStateAtOperation(operations, completedPreviousOperation.id, !isRenderOrSame)

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
  }

  return state
}

export default getStateAtOperation
