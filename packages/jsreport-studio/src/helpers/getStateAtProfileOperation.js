import { applyPatch } from 'diff'
import b64toBlob from './b64toBlob'

function getStateAtProfileOperation (operations, operationId, completed = false) {
  const operation = operations.find((op) => op.id === operationId)
  if (operation == null) {
    throw new Error(`Operation with id "${operationId}" not found, not able to get state`)
  }

  const allEvents = operations.map(op => [op.startEvent, op.endEvent]).flat().filter(e => e)
  let currentEvent = completed ? operation.endEvent : operation.startEvent
  const eventsToDiff = [currentEvent]

  while (currentEvent.previousEventId != null) {
    currentEvent = allEvents.find((e) => e.id === currentEvent.previousEventId)
    eventsToDiff.push(currentEvent)
  }
  eventsToDiff.reverse()

  const currentState = {
    reqContent: '',
    resContent: '',
    resContentEncoding: '',
    resMetaContent: ''
  }

  for (const event of eventsToDiff) {
    currentState.reqContent = applyPatch(currentState.reqContent, event.req.diff)
    currentState.resMetaContent = applyPatch(currentState.resMetaContent, event.res.meta.diff)

    if (event.res.content) {
      currentState.resContentEncoding = event.res.content.encoding
      if (event.res.content.encoding === 'diff') {
        currentState.resContent = applyPatch(currentState.resContent, event.res.content.content)
      } else {
        currentState.resContent = event.res.content.content
      }
    }
  }

  const result = { req: {}, res: {} }
  try {
    result.res.meta = JSON.parse(currentState.resMetaContent)
  } catch (e) {
    console.error('Failed to parse meta ' + currentState.resMetaContent)
  }

  if (result.res.meta.contentType == null) {
    result.res.meta.contentType = 'text/plain'
  }

  if (result.res.meta.fileExtension == null) {
    result.res.meta.fileExtension = 'txt'
  }

  try {
    result.req = JSON.parse(currentState.reqContent)
  } catch (e) {
    console.error('Failed to parse req ' + currentState.reqContent)
  }

  if (currentState.resContentEncoding === 'base64') {
    result.res.content = b64toBlob(currentState.resContent, result.res.meta.contentType)
  } else {
    result.res.content = new Blob([currentState.resContent], { type: result.res.meta.contentType })
  }

  return result
}

export default getStateAtProfileOperation
