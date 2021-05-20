
async function parseProfile (profileStreamReader, onProfileMessage) {
  const textDecoder = new TextDecoder()
  let pending = ''

  const handleMessage = (rawMessage) => {
    let message

    try {
      message = JSON.parse(rawMessage)
    } catch (e) {
      console.error(`Unable to parse profile message. raw: ${rawMessage}`, e)
      return
    }

    onProfileMessage(message)
  }

  await profileStreamReader.read().then(function sendNext ({ value, done }) {
    if (done) {
      if (pending !== '') {
        handleMessage(pending)
      }

      return
    }

    let chunkStr = textDecoder.decode(value)

    if (pending !== '') {
      chunkStr = pending + chunkStr
    }

    let messages = chunkStr.split('\n')

    if (messages.length > 1 && messages[messages.length - 1] !== '') {
      pending = messages.pop()
    }

    messages = messages.filter((m) => m !== '')

    for (const m of messages) {
      handleMessage(m)
    }

    return profileStreamReader.read().then(sendNext)
  })
}

export default parseProfile
