let sequence = 0
module.exports = (workerInitData) => {
  return (actionData, rid) => {
    sequence++
    return new Promise((resolve) => {
      setTimeout(() => resolve(sequence), actionData.delay)
    })
  }
}
