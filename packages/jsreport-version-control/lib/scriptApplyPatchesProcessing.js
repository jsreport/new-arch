const { applyPatches } = require('./patches')

module.exports = async function scriptApplyPatchesProcessing (inputs, callback) {
  const { versions, documentModel } = inputs

  try {
    const state = applyPatches(versions, documentModel)

    return {
      state
    }
  } catch (e) {
    return {
      error: {
        message: e.message,
        stack: e.stack
      }
    }
  }
}
