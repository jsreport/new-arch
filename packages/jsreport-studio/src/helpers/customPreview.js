import isObject from 'lodash/isObject'
import resolveUrl from './resolveUrl.js'

function addInput (form, name, value) {
  const input = document.createElement('input')
  input.type = 'hidden'
  input.name = name
  input.value = value
  form.appendChild(input)
}

export default function (url, request, target) {
  const mapForm = document.createElement('form')

  mapForm.target = target || 'previewFrame'
  mapForm.method = 'POST'

  mapForm.action = resolveUrl(url)

  function addBody (path, body) {
    if (body === undefined) {
      return
    }

    if (!isObject(body) && !(body instanceof Array)) {
      return addInput(mapForm, path, body)
    }

    for (const key in body) {
      if (isObject(body[ key ])) {
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

  for (const key in request) {
    addBody(key, request[key])
  }

  document.body.appendChild(mapForm)

  mapForm.submit()
}
