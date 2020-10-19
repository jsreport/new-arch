const Promise = require('bluebird')
let someVar = 0

module.exports = async ({ managerPort }) => {
    console.log('port', managerPort)
    await Promise.delay(100)
    managerPort.postMessage('hello from the worker pool:' + someVar++);
    await Promise.delay(100)
    managerPort.close()
};