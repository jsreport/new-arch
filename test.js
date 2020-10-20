const client = require('jsreport-client')('http://localhost:5488')
const fs = require('fs')
const Promise = require('bluebird')

const mainData = JSON.parse(fs.readFileSync('stockdata.json').toString())
mainData.fakeItems = []

/*
for (let i = 0; i < 5000000; i++) {
  mainData.fakeItems.push(i)
}
*/

async function run () {
  console.time('render')  
  
  for (let i = 0; i < 1; i++) {
    const promises = []
    for (let j = 0; j < 1; j++) {
      promises.push(client.render({
        template: {
          name: 'main'
        },
        data: mainData
      }))
    }
    await Promise.all(promises)
  }

  console.timeEnd('render')
}

async function runMany () {
  console.time('render')  
  const promises = []  
  for (let i = 0; i < 10; i++) {

    //for (let j = 0; j < 1; j++) {
      promises.push(client.render({
        template: {
          name: 'main'
        },
        data: mainData
      }))
    //}   
  }
  await Promise.all(promises)

  console.timeEnd('render')
}


runMany().catch(e => console.error(e.message))
