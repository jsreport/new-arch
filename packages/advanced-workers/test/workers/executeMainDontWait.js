module.exports = (workerInitData, { executeMain }) => {
  return ({ someData }, rid) => {
    executeMain({
      someData
    }, rid)
  }
}
