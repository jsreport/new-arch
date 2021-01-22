const fs = require('fs').promises

async function data () {
  const loaded = JSON.parse(await fs.readFile('data.json'))
  loaded.array = []
  for (let i = 0; i < 10000; i++) {
    loaded.array.push({
      someProp: 'foooooooooooooo'
    })
  }
  await fs.writeFile('data.json', JSON.stringify(loaded, undefined, 2))
}

data()
