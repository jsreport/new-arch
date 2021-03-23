
module.exports = {
  name: 'fs-store',
  main: 'lib/main.js',
  optionsSchema: {
    store: {
      type: 'object',
      properties: {
        provider: { type: 'string', enum: ['fs'] }
      }
    },
    blobStorage: {
      type: 'object',
      properties: {
        provider: { type: 'string', enum: ['fs'] }
      }
    },
    extensions: {
      'fs-store': {
        type: 'object',
        properties: {
          dataDirectory: { type: 'string' },
          compactionEnabled: { type: 'boolean', default: true },
          compactionInterval: { type: 'number', default: 60000 },
          corruptAlertThreshold: { type: 'number', default: 0.1 },
          persistenceQueueWaitingTimeout: { type: 'number', default: 60000 },
          externalModificationsSync: { type: 'boolean', default: false },
          persistence: {
            type: 'object',
            default: {},
            properties: {
              provider: { type: 'string', enum: ['fs'], default: 'fs' },
              lock: {
                type: 'object',
                properties: {
                  stale: { type: 'number', default: 5000 },
                  retries: { type: 'number', default: 100 },
                  retryWait: { type: 'number', default: 100 }
                }
              }
            }
          }
        }
      }
    }
  },
  dependencies: ['templates']
}
