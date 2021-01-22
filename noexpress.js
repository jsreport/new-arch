const fs = require('fs').promises
const fsStandard = require('fs')
const v8 = require('v8')
const jsreport = require('./')({
  rootDirectory: __dirname
})

let snapshots = 1

jsreport.init().then(async () => {
  const data = JSON.parse(await fs.readFile('data.json'))
  console.time('100 reports took')
  for (let i = 1; i < 300000000000000; i++) {
    if (i % 1000 === 0) {
      console.timeEnd('1000 reports took')
      console.time('1000 reports took')
      console.log(i)
    }

    if (i === 1 || i % 1000 === 0) {
      if (global.gc) {
        global.gc()
        await new Promise(resolve => setTimeout(resolve, 2000))
        const used = process.memoryUsage()

        for (let key in used) {
          console.log(`${key} ${Math.round(used[key] / 1024 / 1024 * 100) / 100} MB`)
        }
        const workserSnapshotStream = await jsreport._workersManager._workerManager.threads[0].getHeapSnapshot()
        workserSnapshotStream.pipe(fsStandard.createWriteStream(`snapshot-worker-${snapshots}.heapsnapshot`))

        v8.getHeapSnapshot().pipe(fsStandard.createWriteStream(`snapshot-${snapshots++}.heapsnapshot`))
      }
    }

    const res = await jsreport.render({
      template: {
        // content: '{{for array}}{{:someProp}}{{/for}}',
        content: 'foo',
        recipe: 'html',
        engine: 'handlebars'
      }
      // data
    })
    // await fs.writeFile('out.pdf', res.content)
  }
  // running
}).catch((e) => {
  // error during startup
  console.error(e.stack)
  process.exit(1)
})
