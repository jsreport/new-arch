/*!
 * Copyright(c) 2018 Jan Blaha
 *
 * Collect and serve logs with request scope
 */

const os = require('os')

function paddingRight (str, length) {
  const padding = (new Array(Math.max(length - str.length + 1, 0))).join(' ')
  return str + padding
}

function logsToFormattedString (logs) {
  if (!logs || logs.length < 1) {
    return ''
  }

  const start = logs[0].timestamp
  return logs.map((m) => {
    const time = (m.timestamp - start)
    const paddedTime = paddingRight(time + '', 7)
    return '+' + paddedTime + m.message
  }).join(os.EOL)
}

function cutResponseHeader (logs, maxLogResponseHeaderSize, logger) {
  let headerSize = 4
  const logsCut = []
  for (let i = 0; i < logs.length && headerSize < maxLogResponseHeaderSize; i++) {
    const log = logs[i]
    headerSize += JSON.stringify(log).length + 2
    if (headerSize < maxLogResponseHeaderSize) {
      logsCut.push(logs[i])
    }
  }

  if (logsCut.length !== logs.length) {
    logger.warn('The size of the debug logs which should have been written to the response header exceeded the limit. The content of the response header ' +
    ' was cut to avoid HPE_HEADER_OVERFLOW errors. To avoid this message, please decrease the number of console.log calls in the template.')
    logsCut.push({
      timestamp: new Date(),
      level: 'warn',
      message: 'The further logs have been cut.'
    })
  }

  return logsCut
}

function cleanHeaderValue (val) {
  let cleanVal = ''
  for (var i = 0; i < val.length; i++) {
    const ch = val.charCodeAt(i)
    if (ch === 9 || ch <= 31 || ch > 255 || ch === 127) {
      continue
    } else {
      cleanVal += val[i]
    }
  }
  return cleanVal
}

function cleanLogsInvalidHeaderValues (logs) {
  return logs.map((l) => ({
    ...l,
    message: cleanHeaderValue(l.message)
  }))
}

module.exports = function (reporter, definition) {
  definition.options = Object.assign({}, { maxLogResponseHeaderSize: 6 * 1024 }, definition.options)

  reporter.initializeListeners.add('request-log', () => {
    reporter.renderErrorListeners.add('request-log', (request, res, e) => {
      if (request.context.isChildRequest) {
        return
      }

      if (request.options.debug && request.options.debug.logsToResponse) {
        e.message += `${os.EOL}logs:${os.EOL}${logsToFormattedString(request.context.logs)}`
      }
    })

    reporter.afterRenderListeners.add('request-log', (request, response) => {
      if (request.context.isChildRequest) {
        return
      }

      if (request.options.debug && request.options.debug.logsToResponseHeader && response.meta.headers) {
        response.meta.headers['Debug-Logs'] = JSON.stringify(
          cleanLogsInvalidHeaderValues(cutResponseHeader(
            request.context.logs,
            definition.options.maxLogResponseHeaderSize,
            reporter.logger
          ))
        )
      }

      if (request.options.debug && request.options.debug.logsToResponse) {
        if (response.meta.headers) {
          response.meta.headers['Content-Type'] = 'text/plain'
          response.meta.headers['Content-Disposition'] = 'inline; filename="log.txt"'
          response.meta.headers['File-Extension'] = 'txt'
        }

        response.content = Buffer.from(logsToFormattedString(request.context.logs))
      }
    })
  })
}
