import parseProfile from './parseProfile'
import methods from '../redux/methods'

import {
  addLog as addProfileLog,
  addOperation as addProfileOperation,
  addError as addProfileError
} from './profileDataManager'

async function openProfileFromStreamReader (getStreamReader, templateInfo) {
  let previewData = {
    template: templateInfo,
    profileLogs: [],
    profileOperations: [],
    profileErrors: { global: null, general: null, operations: [] }
  }

  const previewId = methods.preview({
    type: 'profile',
    data: previewData
  })

  try {
    const streamReader = await getStreamReader()

    await parseProfile(streamReader, (message) => {
      if (message.type === 'log') {
        previewData = addProfileLog(previewData, message)
        methods.updatePreview(previewId, { data: previewData })
      } else if (message.type === 'operationStart' || message.type === 'operationEnd') {
        previewData = addProfileOperation(previewData, message)
        methods.updatePreview(previewId, { data: previewData })
      } else if (message.type === 'error') {
        previewData = addProfileError(previewData, message)
        methods.updatePreview(previewId, { data: previewData })
      }
    })
  } finally {
    methods.updatePreview(previewId, { completed: true })
  }
}

export default openProfileFromStreamReader
