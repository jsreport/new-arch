
module.exports = {
  name: 'static-pdf',
  main: 'lib/main.js',
  worker: 'lib/worker.js',
  dependencies: ['assets'],
  requires: {
    core: '2.x.x'
  }
}
