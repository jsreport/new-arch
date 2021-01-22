const path = require('path')
const fs = require('fs').promises

const workersManager = new (require('./index'))({}, {
  workerModule: path.join(__dirname, 'workerHandler.js')
})

if (global.gc) {
  setInterval(() => {
    global.gc()
    const used = process.memoryUsage()
    for (const key in used) {
      console.log(`${key} ${Math.round(used[key] / 1024 / 1024 * 100) / 100} MB`)
    }
  }, 10000)
}

async function test () {
  await workersManager.init()

  const data = JSON.parse(await fs.readFile(path.join(__dirname, '../../data.json')))

  for (let i = 0; i < 100000000000; i++) {
    if (i % 10000 === 0) {
      // global.gc()
      console.log(i)
    }
    await workersManager.executeWorker({
      foo: 'hesssssssssssssssssssssssssssssssssssssssssssssllo'
      // data
    }, {
      executeMain: async () => {

      }
    })
  }

  await workersManager.close()
}

test().catch(console.error)
