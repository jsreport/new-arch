const axios = require('axios')
const FormData = require('form-data')
const toArray = require('stream-to-array')
const { promisify } = require('util')
const toArrayAsync = promisify(toArray)

const officeDocuments = {
  docx: {
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  },
  pptx: {
    contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  },
  xlsx: {
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  }
}

module.exports = async function response ({
  previewOptions: { publicUri, enabled },
  officeDocumentType,
  stream,
  buffer
}, req, res) {
  if (buffer) {
    res.content = buffer
  } else {
    res.content = Buffer.concat(await toArrayAsync(stream))
  }

  if (officeDocuments[officeDocumentType] == null) {
    throw new Error(`Unsupported office document type "${officeDocumentType}"`)
  }

  const isPreviewRequest = req.options.preview === true || req.options.preview === 'true'
  const isOfficePreviewRequest = req.options.office != null && (req.options.office.preview === true || req.options.office.preview === 'true')

  if (enabled === false || (!isPreviewRequest && !isOfficePreviewRequest)) {
    res.meta.fileExtension = officeDocumentType
    res.meta.contentType = officeDocuments[officeDocumentType].contentType
    res.meta.officeDocumentType = officeDocumentType
    return
  }

  const form = new FormData()

  form.append('field', res.content, `file.${officeDocumentType}`)

  let resp

  const targetPublicUri = publicUri || 'http://jsreport.net/temp'

  try {
    resp = await axios.post(targetPublicUri, form, {
      headers: form.getHeaders(),
      // axios by default has no limits but there is a bug
      // https://github.com/axios/axios/issues/1362 (when following redirects) in
      // which the default limit is not taking into account, so we set it explicetly
      maxContentLength: Infinity
    })
  } catch (e) {
    const originalMsg = e.message

    e.message = `${officeDocumentType} file upload to ${targetPublicUri} failed`

    if (e.response && e.response.status && e.response.status === 413) {
      e.message = `. file is too big and it pass the upload limits of server`
    }

    e.message += `. ${originalMsg}`

    throw e
  }

  const iframe = '<iframe style="height:100%;width:100%" src="https://view.officeapps.live.com/op/view.aspx?src=' +
    encodeURIComponent((targetPublicUri + '/') + resp.data) + '" />'

  const html = `<html><head><title>${res.meta.reportName}</title><body>${iframe}</body></html>`

  res.content = Buffer.from(html)
  res.meta.contentType = 'text/html'
  res.meta.fileExtension = '.html'
}
