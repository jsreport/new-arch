const client = require('jsreport-client')('http://localhost:5488')
const fs = require('fs').promises

async function run () {
  console.time('render')
  const data = JSON.parse(await fs.readFile('data.json'))
  for (let i = 0; i < 1000; i++) {
    const res = await client.render({
      template: {
        content: 'test',
        recipe: 'html',
        engine: 'none'
      },
      data
    })
    const bodyBuffer = await res.body()
  }
  console.timeEnd('render')
  // await fs.writeFile('out.pdf', bodyBuffer)
}

run().catch((e) => console.error(e.stack))
