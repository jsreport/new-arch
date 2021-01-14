module.exports = (workerInitData, { executeMain }) => {
  return ({ someData }, rid) => {
    return executeMain({
      someData
    }, rid)
  }
}
