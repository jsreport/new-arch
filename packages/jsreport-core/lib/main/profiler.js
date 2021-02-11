const EventEmitter = require('events')

module.exports = class Profiler extends EventEmitter {
  constructor (req) {
    super()
    this.req = req
  }
}
