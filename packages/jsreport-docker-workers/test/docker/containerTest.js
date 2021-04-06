const Container = require('../lib/docker/container.js')
const reporter = require('jsreport-core')()
const axios = require('axios')

describe('container', () => {
  let container

  beforeEach(() => {
    container = new Container({
      exposedPort: 2000,
      port: 2000,
      image: 'jsreport/jsreport-worker',
      startTimeout: 2000,
      logger: reporter.logger,
      network: 'nw_jsreport_docker_workers',
      id: `jsreport_worker_1`
    })
  })

  afterEach(() => container.remove())

  it('container should be reachable after start', async () => {
    await container.start()
    await axios.get(container.url)
  })

  it('container should be reachable after restart', async () => {
    await container.start()
    await container.restart()
    await axios.get(container.url)
  })

  it('container should be reachable after multiple start', async () => {
    await container.start()
    await container.start()
    await axios.get(container.url)
  })

  it('container should not be reachable after remove', async () => {
    await container.start()
    await container.remove()
    return axios.get(container.url).should.be.rejected()
  })
})
