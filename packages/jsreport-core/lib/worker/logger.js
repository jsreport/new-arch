const util = require('util')
const getLogMeta = require('../shared/getLogMeta')

module.exports = function createLogger (executeMainAction) {
  return {
    debug: (...args) => logFn('debug', executeMainAction, ...args),
    info: (...args) => logFn('info', executeMainAction, ...args),
    warn: (...args) => logFn('warn', executeMainAction, ...args),
    error: (...args) => logFn('error', executeMainAction, ...args)
  }
}

function logFn (level, executeMainAction, ...args) {
  const lastArg = args.slice(-1)[0]
  let req

  if (
    lastArg != null &&
    typeof lastArg === 'object' &&
    lastArg.context != null &&
    lastArg.context.rootId != null
  ) {
    req = lastArg
  }

  if (req == null) {
    return
  }

  const msgArgs = args.slice(0, -1)

  const log = {
    timestamp: new Date().getTime(),
    level: level,
    message: util.format.apply(util, msgArgs)
  }

  const meta = getLogMeta(level, log.message, lastArg)

  if (meta != null) {
    log.meta = meta
  }

  log.previousOperationId = req.context.profilerLastOperationId

  return executeMainAction('log', {
    ...log
  }, req)
}
