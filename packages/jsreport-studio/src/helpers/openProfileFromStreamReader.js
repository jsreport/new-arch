import parseProfile from './parseProfile'
import methods from '../redux/methods'

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

  try {
    const streamReader = await getStreamReader()

    await parseProfile(streamReader, (message) => {
      previewData = addProfileEvent(previewData, message)
      methods.updatePreview(previewId, { data: previewData })
    })
  } finally {
    methods.updatePreview(previewId, { completed: true })
  }
}

export default openProfileFromStreamReader
