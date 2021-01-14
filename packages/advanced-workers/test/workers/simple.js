module.exports = (workerInitData) => {
  return (actionData, rid) => {
    return {
      actionData,
      workerInitData
    }
  }
}
