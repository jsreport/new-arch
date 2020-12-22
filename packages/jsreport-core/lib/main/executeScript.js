
module.exports = async function executeScript (reporter, scriptManager, inputs, options, req) {
  try {
    const inputsToUse = Object.assign({}, inputs)
    const optionsToUse = Object.assign({}, options)

    const result = await scriptManager.execute(inputsToUse, optionsToUse)

    return result
  } catch (e) {
    throw reporter.createError(undefined, {
      weak: true,
      original: e
    })
  }
}
