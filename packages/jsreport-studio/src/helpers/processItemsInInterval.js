
function processItemsInInterval ({ baseInterval, queue, fulfilledCheck, handler }) {
  const processingExecution = {}

  processingExecution.promise = new Promise((resolve, reject) => {
    processingExecution.resolve = resolve
    processingExecution.reject = reject
  })

  setTimeout(function processItemsInQueue () {
    const isFulfilled = fulfilledCheck()
    let shouldContinue = !isFulfilled || queue.length > 0
    let nextInterval = baseInterval

    if (queue.length > 0) {
      const nextIntervalFromHandler = handler(queue, isFulfilled)

      if (nextIntervalFromHandler != null) {
        nextInterval = nextIntervalFromHandler
      }

      shouldContinue = !fulfilledCheck() || queue.length > 0
    }

    if (shouldContinue) {
      setTimeout(processItemsInQueue, nextInterval)
    } else {
      processingExecution.resolve()
    }
  }, baseInterval)

  return processingExecution.promise
}

module.exports = processItemsInInterval
