const Piscina = require('piscina');
const { resolve } = require('path');
const { MessageChannel } = require('worker_threads');
const EventEmitter = require('events')

const piscina = new Piscina({
  filename: resolve(__dirname, 'worker.js'),
  minThreads: 1,
  maxThreads: 1,
  idleTimeout: Infinity
});

async function run () {
    const abortEmitter = new EventEmitter()
    let { port1: workerPort, port2: managerPort } = new MessageChannel()
    workerPort.on('message', (message) => {
      console.log(message);
      workerPort.close();
    });
    await piscina.runTask({ managerPort }, [managerPort], abortEmitter);
    workerPort.close()
}

(async function () {
  await run ()
  await run () 
})();