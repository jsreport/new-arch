const axios = require('axios')
const serializator = require('serializator')

// TODO handle timeouts!!!
module.exports = async (url, data, processMainAction) => {
  while (true) {
    const stringBody = serializator.serialize(data)
    let res
    try {
      res = await axios({
        method: 'POST',
        url,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        responseType: 'text',
        transformResponse: [data => data],
        headers: {
          'Content-Type': 'text/plain',
          'Content-Length': Buffer.byteLength(stringBody)
        },
        data: stringBody
      })
    } catch (err) {
      if (!err.response?.data) {
        throw new Error('Error when communicating with worker: ' + err.message)
      }

      const errorData = JSON.parse(err.response.data)
      const workerError = new Error(errorData.message)
      Object.assign(workerError, errorData)
      throw workerError
    }

    if (res.status === 201) {
      return serializator.parse(res.data)
    }

    if (res.status !== 200) {
      throw new Error('Unexpected response from worker: ' + res.data)
    }

    data = {
      actionName: 'response',
      req: data.req,
      data: await processMainAction(serializator.parse(res.data))
    }
  }
}
