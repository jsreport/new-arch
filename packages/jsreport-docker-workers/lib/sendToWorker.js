const axios = require('axios')
const serializator = require('serializator')

module.exports = async (url, data, { executeMain, timeout }) => {
  return new Promise((resolve, reject) => {
    let isDone = false
    setTimeout(() => {
      if (isDone) {
        return
      }

      isDone = true
      reject(new Error('Timeout when communicating with worker'))
    }, timeout)

    ;(async () => {
      while (true && !isDone) {
        const stringBody = serializator.serialize({ ...data, timeout })
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
            data: stringBody,
            timeout: timeout
          })
        } catch (err) {
          if (!err.response?.data) {
            isDone = true
            return reject(new Error('Error when communicating with worker: ' + err.message))
          }

          const errorData = JSON.parse(err.response.data)
          const workerError = new Error(errorData.message)
          Object.assign(workerError, errorData)
          isDone = true
          return reject(workerError)
        }

        if (res.status === 201) {
          isDone = true
          return resolve(serializator.parse(res.data))
        }

        if (res.status !== 200) {
          isDone = true
          return reject(new Error('Unexpected response from worker: ' + res.data))
        }

        data = {
          actionName: 'response',
          // we need just the request identification in the worker
          req: { context: { rootId: data.req.context.rootId } },
          data: await executeMain(serializator.parse(res.data))
        }
      }
    })().catch((e) => {
      isDone = true
      reject(e)
    })
  })
}
