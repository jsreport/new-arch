import parseProfile from './parseProfile'
import methods from '../redux/methods'
import processItemsInInterval from './processItemsInInterval'

import {
  addEvent as addProfileEvent
} from './profileDataManager'

async function openProfileFromStreamReader (getStreamReader, templateInfo) {
  let previewData = {
    template: templateInfo,
    profileLogs: [],
    profileOperations: []
  }

  const previewId = methods.preview({
    type: 'profile',
    data: previewData
  })

  const messages = []
  let parsing = true
  let parseErr

  const messagesProcessingPromise = processItemsInInterval({
    baseInterval: 16,
    queue: messages,
    fulfilledCheck: () => {
      return parsing === false
    },
    handler: (pending, isFulfilled) => {
      const toProcess = []

      if (!isFulfilled) {
        let stop = false

        do {
          const message = pending.shift()

          toProcess.push(message)

          if (
            message.length > 2000 ||
            pending.length === 0 ||
            pending[0].length > 2000
          ) {
            stop = true
          }
        } while (!stop)
      } else {
        let count = 0
        // if queue is fulfilled then we process all pending
        // messages in batches
        let pendingMessage

        do {
          pendingMessage = pending.shift()

          if (pendingMessage != null) {
            toProcess.push(pendingMessage)
            count++
          }
        } while (pendingMessage != null && count < 100)
      }

      for (const rawMessage of toProcess) {
        let message

        try {
          message = JSON.parse(rawMessage)
        } catch (e) {
          console.error(`Unable to parse profile message. raw: ${rawMessage}`, e)
          continue
        }

        previewData = addProfileEvent(previewData, message)
      }

      const completed = pending.length === 0

      const updateChanges = {
        data: previewData
      }

      if (completed) {
        updateChanges.completed = completed
      }

      methods.updatePreview(previewId, updateChanges)
    }
  })

  try {
    const streamReader = await getStreamReader()

    await parseProfile(streamReader, (message) => {
      messages.push(message)
    })
  } catch (err) {
    parseErr = err
  }

  parsing = false
  await messagesProcessingPromise

  if (parseErr) {
    methods.updatePreview(previewId, { completed: true })
    throw parseErr
  }
}

export default openProfileFromStreamReader
