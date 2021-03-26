import isObject from 'lodash/isObject'
import parseStreamingMultipart from './parseStreamingMultipart'
import getPreviewWindowName from '../helpers/getPreviewWindowName'
import resolveUrl from '../helpers/resolveUrl.js'
import { extensions } from '../lib/configuration.js'

export default async function (request, target) {
  delete request.template._id
  request.template.content = request.template.content || ' '

  request.options = request.options || {}
  request.options.preview = true

  if (extensions.studio.options.asyncRender) {
    await streamRender(request, target)
  } else {
    await render(request, target)
  }
}

async function streamRender (request, target) {
  const templateName = request.template.name

  if (target.type === 'download') {
    delete request.options.preview
  }

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

      const files = []

      let parsing = true

      let filesProcessingExecution = {}

      filesProcessingExecution.promise = new Promise((resolve, reject) => {
        filesProcessingExecution.resolve = resolve
        filesProcessingExecution.reject = reject
      })

      window.requestAnimationFrame(function processFile () {
        const shouldContinue = parsing || files.length > 0

        if (files.length > 0) {
          const toProcess = []
          let stop = false

          do {
            const fileInfo = files.shift()

            toProcess.push(fileInfo)

            if (
              fileInfo.rawData.length > 2000 ||
              files.length === 0 ||
              files[0].rawData.length > 2000
            ) {
              stop = true
            }
          } while (!stop)

          for (const fileInfo of toProcess) {
            try {
              target.processFile(fileInfo, target.previewId, target.previewName)
            } catch (e) {
              console.error(`Error during onFile callback of "${fileInfo.name}" entry`, e)
            }
          }
        }

        if (shouldContinue) {
          window.requestAnimationFrame(processFile)
        } else {
          filesProcessingExecution.resolve()
        }
      })

      let parseErr

      try {
        await parseStreamingMultipart(response, (fileInfo) => {
          files.push(fileInfo)
        })

        parsing = false
      } catch (err) {
        parseErr = err
        parsing = false
      }

      await filesProcessingExecution.promise

      if (parseErr) {
        throw parseErr
      }
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
    const newError = new Error(`Render Preview failed. ${e.message}`)

    newError.stack = e.stack
    Object.assign(newError, e)

    throw newError
  }
}

async function render (request, target) {
  const templateName = request.template.name
  const mapForm = document.createElement('form')

  let formTarget
  const windowPrefix = 'window-'

  if (target.type === 'download') {
    formTarget = '_self'
    delete request.options.preview
    request.options.download = true
  } else if (target.type.indexOf(windowPrefix) === 0) {
    formTarget = getPreviewWindowName(target.type.slice(windowPrefix.length))
  } else {
    formTarget = 'previewFrame'
  }

  mapForm.target = formTarget
  mapForm.method = 'POST'

  // we set the template name in url just to show a title in the preview iframe, the name
  // won't be using at all on server side logic
  mapForm.action = templateName ? resolveUrl(`/api/report/${encodeURIComponent(templateName)}`) : resolveUrl('/api/report')

  function addBody (path, body) {
    if (body === undefined) {
      return
    }

    for (const key in body) {
      if (isObject(body[ key ])) {
        // if it is an empty object or array then it should not be added to form,
        // this fix problem with url encoded data which can not represent empty arrays or objects
        // so instead of sending empty `template[scripts]:` we don't add the value at all
        if (Object.keys(body[ key ]).length === 0) {
          continue
        }

        addBody(path + '[' + key + ']', body[ key ])
      } else {
        if (body[ key ] !== undefined && !(body[ key ] instanceof Array)) {
          addInput(mapForm, path + '[' + key + ']', body[ key ])
        }
      }
    }
  }

  addBody('template', request.template)
  addBody('options', request.options)

  if (request.data) {
    addInput(mapForm, 'data', request.data)
  }

  document.body.appendChild(mapForm)

  mapForm.submit()

  function addInput (form, name, value) {
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = name
    input.value = value
    form.appendChild(input)
  }
}
