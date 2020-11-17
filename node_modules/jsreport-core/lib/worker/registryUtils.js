
function getValues (registry, req) {
  const requestRootId = req.context.rootId

  const requestValues = registry.get(requestRootId) || {}

  return requestValues
}

function getCallback (registry, req) {
  const requestValues = getValues(registry, req)

  if (requestValues.callback == null) {
    throw new Error('No callback attached to request')
  }

  return requestValues.callback
}

module.exports.getValues = getValues
module.exports.getCallback = getCallback
