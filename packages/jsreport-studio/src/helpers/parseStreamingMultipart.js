// eslint-disable-next-line no-control-regex
const PARAM_REGEXP = /;[\x09\x20]*([!#$%&'*+.0-9A-Z^_`a-z|~-]+)[\x09\x20]*=[\x09\x20]*("(?:[\x20!\x23-\x5b\x5d-\x7e\x80-\xff]|\\[\x20-\x7e])*"|[!#$%&'*+.0-9A-Z^_`a-z|~-]+)[\x09\x20]*/g
// eslint-disable-next-line no-control-regex
const DISPOSITION_TYPE_REGEXP = /^([!#$%&'*+.0-9A-Z^_`a-z|~-]+)[\x09\x20]*(?:$|;)/
// eslint-disable-next-line no-control-regex
const QESC_REGEXP = /\\([\u0000-\u007f])/g
const NEW_LINE = '\r\n'
// const HEADER_DELIMITER = `${NEW_LINE}${NEW_LINE}`
const NEW_LINE_BUF = new TextEncoder().encode(NEW_LINE)

async function parseStreamingMultipart (response, onFile) {
  const contentType = response.headers.get('Content-Type')
  const boundary = getBoundary(contentType)

  const reader = response.body.getReader()
  const textDecoder = new TextDecoder()

  const parsingProgress = {
    state: 'initial',
    pending: new Uint8Array(0),
    meta: {}
  }

  const onResponse = (partsFound) => {
    for (let i = 0; i < partsFound.length; i++) {
      try {
        onFile(partsFound[i])
      } catch (e) {
        console.error(`Error during onFile callback of "${partsFound[i].name}" entry`, e)
      }
    }
  }

  return reader.read().then(function sendNext ({ value, done }) {
    if (done) {
      return
    }

    try {
      const parts = parseMultipartHttp(parsingProgress, textDecoder, value, boundary, [])

      if (parts.length > 0) {
        onResponse(parts)
      }
    } catch (err) {
      const parseError = new Error(`Parsing error. ${err.message}`)
      parseError.stack = err.stack
      throw parseError
    }

    return reader.read().then(sendNext)
  })
}

export default parseStreamingMultipart

// TODO: still pending to handle the cases in which the parsing is not complete because the chunk
// contains just part of the data
function parseMultipartHttp (parsingProgress, textDecoder, buffer, boundary, previousParts = []) {
  const chunk = concatUInt8Array(parsingProgress.pending, buffer)
  const newParts = [...previousParts]
  let rest

  if (parsingProgress.state === 'initial') {
    const boundaryDelimiterByteLength = new TextEncoder().encode(getDelimiter(boundary)).byteLength
    // skip the first bytes that contain the boundary delimiters
    const results = parseUntilDelimiter(chunk.slice(boundaryDelimiterByteLength), concatUInt8Array(NEW_LINE_BUF, NEW_LINE_BUF))

    if (results.length === 0) {
      parsingProgress.pending = chunk
    } else {
      const headers = textDecoder.decode(results[0])
      rest = results[1]

      const parsedHeaders = parseHeaders(headers)

      const contentLengthHeader = parsedHeaders['content-length']

      if (contentLengthHeader === undefined) {
        throw new Error('Invalid MultiPart Response, no content-length header')
      }

      const contentLength = parseInt(contentLengthHeader, 10)

      if (isNaN(contentLength)) {
        throw new Error('Invalid MultiPart Response, could not parse content-length')
      }

      const contentDisposition = parsedHeaders['content-disposition']
      const [contentDispositionType, contentDispositionParams] = parseContentDisposition(contentDisposition)

      parsingProgress.state = 'header'
      parsingProgress.meta.name = contentDispositionParams.name
      parsingProgress.meta.filename = contentDispositionParams.filename
      parsingProgress.meta.contentDispositionType = contentDispositionType
      parsingProgress.meta.contentType = parsedHeaders['content-type']
      parsingProgress.meta.contentLength = contentLength
      parsingProgress.meta.headers = parsedHeaders
      parsingProgress.pending = new Uint8Array(0)
    }
  } else if (parsingProgress.state === 'header') {
    if (chunk.length < parsingProgress.meta.contentLength) {
      parsingProgress.pending = chunk
    } else {
      const finalBoundaryDelimeterBuf = new TextEncoder().encode(getFinalDelimiter(boundary))
      const body = chunk.slice(0, parsingProgress.meta.contentLength)

      rest = chunk.slice(parsingProgress.meta.contentLength)

      if (
        arrayBufferEqual(rest.buffer, finalBoundaryDelimeterBuf.buffer)
      ) {
        rest = undefined
      }

      const part = {
        name: parsingProgress.meta.name,
        filename: parsingProgress.meta.filename,
        contentDispositionType: parsingProgress.meta.contentDispositionType,
        contentType: parsingProgress.meta.contentType,
        contentLength: parsingProgress.meta.contentLength,
        headers: parsingProgress.meta.headers,
        rawData: body
      }

      newParts.push(part)

      parsingProgress.state = 'initial'
      parsingProgress.meta = {}
      parsingProgress.pending = new Uint8Array(0)
    }
  }

  if (rest && rest.length > 0) {
    return parseMultipartHttp(parsingProgress, textDecoder, rest, boundary, newParts)
  }

  return newParts
}

function parseUntilDelimiter (chunk, delimiterChunk) {
  let content
  let rest

  const delimiterChunkByteLength = delimiterChunk.byteLength

  for (let i = 0; i < chunk.length; i++) {
    if (arrayBufferEqual(chunk.slice(i, i + delimiterChunkByteLength).buffer, delimiterChunk.buffer)) {
      content = chunk.slice(0, i)

      if (chunk.length > i) {
        rest = chunk.slice(i + delimiterChunkByteLength)
      }

      break
    }
  }

  if (content) {
    if (rest) {
      return [content, rest]
    }

    return [content]
  }

  return []
}

function arrayBufferEqual (buf1, buf2) {
  if (buf1 === buf2) {
    return true
  }

  if (buf1.byteLength !== buf2.byteLength) {
    return false
  }

  var view1 = new DataView(buf1)
  var view2 = new DataView(buf2)

  let i = buf1.byteLength

  while (i--) {
    if (view1.getUint8(i) !== view2.getUint8(i)) {
      return false
    }
  }

  return true
}

function concatUInt8Array (buf1, buf2) {
  const result = new Uint8Array(buf1.length + buf2.length)
  result.set(buf1)
  result.set(buf2, buf1.length)
  return result
}

function getBoundary (contentType = '') {
  const contentTypeParts = contentType.split(';')

  for (const contentTypePart of contentTypeParts) {
    const [key, value] = (contentTypePart || '').trim().split('=')

    if (key === 'boundary' && !!value) {
      if (value[0] === '"' && value[value.length - 1] === '"') {
        return value.substr(1, value.length - 2)
      }

      return value
    }
  }

  return '-'
}

function parseHeaders (headers) {
  const result = {}
  const headersArr = headers.split(NEW_LINE)

  for (let i = 0; i < headersArr.length; i++) {
    const row = headersArr[i]
    const index = row.indexOf(':')
    const key = trim(row.slice(0, index)).toLowerCase()
    const value = trim(row.slice(index + 1))

    if (typeof result[key] === 'undefined') {
      result[key] = value
    } else if (Array.isArray(result[key])) {
      result[key].push(value)
    } else {
      result[key] = [result[key], value]
    }
  }

  return result
}

function parseContentDisposition (string) {
  if (!string || typeof string !== 'string') {
    throw new TypeError('argument string is required')
  }

  let match = DISPOSITION_TYPE_REGEXP.exec(string)

  if (!match) {
    throw new TypeError('invalid type format')
  }

  // normalize type
  let index = match[0].length
  const type = match[1].toLowerCase()

  let key
  let names = []
  let params = {}
  let value

  // calculate index to start at
  index = PARAM_REGEXP.lastIndex = match[0].substr(-1) === ';' ? index - 1 : index

  // match parameters
  while ((match = PARAM_REGEXP.exec(string))) {
    if (match.index !== index) {
      throw new TypeError('invalid parameter format')
    }

    index += match[0].length
    key = match[1].toLowerCase()
    value = match[2]

    if (names.indexOf(key) !== -1) {
      throw new TypeError('invalid duplicate parameter')
    }

    names.push(key)

    if (key.indexOf('*') + 1 === key.length) {
      // decode extended value
      throw new Error('Content-Disposition value not supported')
    }

    if (typeof params[key] === 'string') {
      continue
    }

    if (value[0] === '"') {
      // remove quotes and escapes
      value = value
        .substr(1, value.length - 2)
        .replace(QESC_REGEXP, '$1')
    }

    params[key] = value
  }

  if (index !== -1 && index !== string.length) {
    throw new TypeError('invalid parameter format')
  }

  return [type, params]
}

function trim (string) {
  return string.replace(/^\s+|\s+$/g, '')
}

function getDelimiter (boundary) {
  return `${NEW_LINE}--${boundary}${NEW_LINE}`
}

function getFinalDelimiter (boundary) {
  return `${NEW_LINE}--${boundary}--${NEW_LINE}`
}
