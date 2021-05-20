
function addLog (data, log) {
  const newData = {
    ...data,
    profileLogs: [...data.profileLogs, {
      level: log.level,
      message: log.message,
      timestamp: log.timestamp,
      previousOperationId: log.previousOperationId
    }]
  }

  return newData
}

function addOperation (data, operation) {
  let newOperations = data.profileOperations

  if (operation.type === 'operationEnd') {
    let foundIndex

    for (let i = data.profileOperations.length - 1; i >= 0; i--) {
      const targetOperation = data.profileOperations[i]

      if (targetOperation.id === operation.id) {
        foundIndex = i
        break
      }
    }

    if (foundIndex == null) {
      throw new Error(`Operation with id "${operation.id}" not found`)
    }

    const foundOperation = data.profileOperations[foundIndex]

    newOperations = [...data.profileOperations.slice(0, foundIndex), {
      ...foundOperation,
      completed: true,
      completedTimestamp: operation.timestamp,
      completedReq: operation.req,
      completedRes: operation.res,
      completedPreviousOperationId: operation.previousOperationId
    }, ...data.profileOperations.slice(foundIndex + 1)]
  } else {
    newOperations = [...data.profileOperations, {
      id: operation.id,
      type: operation.subtype,
      name: operation.name,
      timestamp: operation.timestamp,
      profileId: operation.profileId,
      req: operation.req,
      res: operation.res,
      previousOperationId: operation.previousOperationId,
      completed: false,
      completedTimestamp: null,
      completedReq: null,
      completedRes: null,
      completedPreviousOperationId: null
    }]
  }

  return {
    ...data,
    profileOperations: newOperations
  }
}

function addError (data, errorInfo) {
  const newProfileErrors = { ...data.profileErrors }
  let newProfileOperations

  if (errorInfo.id != null && errorInfo.previousOperationId != null) {
    newProfileErrors.operations = { ...newProfileErrors.operations }
    newProfileErrors.operations[errorInfo.previousOperationId] = errorInfo

    let foundIndex

    for (let i = data.profileOperations.length - 1; i >= 0; i--) {
      const targetOperation = data.profileOperations[i]

      if (targetOperation.id === errorInfo.previousOperationId) {
        foundIndex = i
        break
      }
    }

    if (foundIndex != null) {
      const foundOperation = data.profileOperations[foundIndex]

      newProfileOperations = [...data.profileOperations.slice(0, foundIndex), {
        ...foundOperation,
        completedTimestamp: errorInfo.timestamp,
        completedPreviousOperationId: errorInfo.previousOperationId
      }, ...data.profileOperations.slice(foundIndex + 1)]
    }
  } else if (errorInfo.type === 'globalError') {
    newProfileErrors.global = errorInfo
  } else {
    newProfileErrors.general = errorInfo
  }

  const newData = {
    ...data,
    profileErrors: newProfileErrors
  }

  if (newProfileOperations != null) {
    newData.profileOperations = newProfileOperations
  }

  return newData
}

export { addLog, addOperation, addError }
