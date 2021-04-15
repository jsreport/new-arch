
module.exports = {
  name: 'docker-workers',
  main: 'lib/main.js',
  dependencies: ['express'],
  optionsSchema: {
    ip: { type: 'string' },
    stack: { type: 'string', default: 'default' },
    extensions: {
      'docker-workers': {
        type: 'object',
        properties: {
          discriminatorPath: { type: 'string', default: 'context.rootId' },
          containerParallelRequestsLimit: { type: 'number' },
          pingServersInterval: { type: 'number', default: 5000 },
          pingHealthyInterval: { type: 'number', default: 20000 },
          container: {
            type: 'object',
            default: {
              image: 'jsreport/jsreport-worker',
              namePrefix: 'jsreport_worker',
              exposedPort: 2000,
              basePublishPort: 2001,
              baseDebugPort: 9230,
              startTimeout: 10000,
              restartPolicy: true,
              warmupPolicy: true,
              delegateTimeout: 50000,
              debuggingSession: false,
              memorySwap: '512m',
              memory: '420m',
              cpus: '0.5',
              logDriver: 'json-file',
              tempVolumeTarget: '/tmp'
            },
            properties: {
              image: { type: 'string', default: 'jsreport/jsreport-worker' },
              namePrefix: { type: 'string', default: 'jsreport_worker' },
              exposedPort: { type: 'number', default: 2000 },
              basePublishPort: { type: 'number', default: 2001 },
              baseDebugPort: { type: 'number', default: 9230 },
              customEnv: {
                anyOf: [{
                  type: 'string',
                  '$jsreport-constantOrArray': []
                }, {
                  type: 'array',
                  items: { type: 'string' }
                }]
              },
              startTimeout: { type: 'number', default: 10000 },
              restartPolicy: { type: 'boolean', default: true },
              warmupPolicy: { type: 'boolean', default: true },
              restartTimeout: { type: 'number', default: 5000 },
              delegateTimeout: { type: 'number', default: 50000 },
              debuggingSession: { type: 'boolean', default: false },
              memorySwap: { type: 'string', default: '512m' },
              memory: { type: 'string', default: '420m' },
              cpus: { type: 'string', default: '0.5' },
              logDriver: { type: 'string', default: 'json-file' },
              logOpt: { type: 'object' },
              tempVolumeSourcePrefix: { type: 'string' },
              tempVolumeTarget: { type: 'string', default: '/tmp' }
            }
          },
          subnet: { type: 'string', default: '172.30.0.0/24' },
          network: { type: 'string', default: 'nw_jsreport_docker_workers' },
          busyQueueWaitingTimeout: { type: 'number', default: 10000 },
          numberOfWorkers: { type: 'number', minimum: 1, default: 4 }
        }
      }
    }
  }
}
