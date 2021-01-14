import parseStreamingMultipart from './parseStreamingMultipart'
import resolveUrl from '../helpers/resolveUrl.js'

export default async function (request, target) {
  delete request.template._id
  request.template.content = request.template.content || ' '

  request.options = request.options || {}
  request.options.preview = true

  if (target === '_self') {
    delete request.options.preview
    request.options.download = true
  }

  const templateName = request.template.name

  let url = templateName ? resolveUrl(`/api/report/${encodeURIComponent(templateName)}`) : resolveUrl('/api/report')

  url = `${url}?logsStreaming=true`

  try {
    target.focus()

    const response = await window.fetch(url, {
      method: 'POST',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        template: request.template,
        options: request.options,
        data: request.data
      })
    })

    let contentType = ''

    if (response.headers != null) {
      contentType = response.headers.get('Content-Type') || ''
    }

    if (response.status === 200) {
      if (contentType.indexOf('multipart/mixed') === -1) {
        throw new Error('Got invalid response content-type, expected multipart/mixed')
      }

      await parseStreamingMultipart(response, (fileInfo) => {
        target.processFile(fileInfo)
      })
    } else {
      let content

      if (contentType === 'application/json') {
        content = await response.json()
      } else {
        content = await response.text()
      }

      const notOkError = new Error('Got not ok response')

      notOkError.data = content

      throw notOkError
    }
  } catch (e) {
    const newError = new Error(`Preview failed. ${e.message}`)

    newError.stack = e.stack
    Object.assign(newError, e)

    throw newError
  }
}
