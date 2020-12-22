import isObject from 'lodash/isObject'
import resolveUrl from '../helpers/resolveUrl.js'

function addInput (form, name, value) {
  const input = document.createElement('input')
  input.type = 'hidden'
  input.name = name
  input.value = value
  form.appendChild(input)
}

export default function (request, target) {
  delete request.template._id
  request.template.content = request.template.content || ' '

  request.options = request.options || {}
  request.options.preview = true

  if (target === '_self') {
    delete request.options.preview
    request.options.download = true
  }

  const templateName = request.template.name
  const mapForm = document.createElement('form')

  mapForm.target = target
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
}
