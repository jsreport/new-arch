const createContainersPool = require('../lib/docker/containersPool.js')
const reporter = require('jsreport-core')()
const axios = require('axios')
const Promise = require('bluebird')
require('should')

describe('containers pool', () => {
  let containersPool

  beforeEach(() => {
    containersPool = createContainersPool({
      exposedPort: 2000,
      basePublishPort: 2000,
      image: 'jsreport/jsreport-worker',
      logger: reporter.logger,
      network: 'nw_jsreport_docker_workers',
      subnet: '172.30.0.0/24',
      namePrefix: 'jsreport_worker',
      numberOfWorkers: 3
    })
  })

  afterEach(() => containersPool.removeContainers())

  it('should create specific number of reachable containers', async () => {
    await containersPool.createNetworkForContainers()
    await containersPool.startContainers()

    containersPool.containers.should.have.length(3)
    return Promise.all(containersPool.containers.map((c) => axios.get(c.url)))
  })
})
