
const schema = {
  type: 'object',
  properties: {
    provider: { type: 'string' },
    diffLimit: { type: 'string', default: '300kb' }
  }
}

module.exports = {
  name: 'version-control',
  main: 'lib/main/main.js',
  worker: 'lib/worker/worker.js',
  optionsSchema: {
    versionControl: schema,
    extensions: {
      'version-control': schema
    }
  },
  dependencies: [],
  requires: {
    core: '2.x.x',
    studio: '2.x.x'
  }
}
