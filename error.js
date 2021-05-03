module.exports = () => {
  return {
    init: () => {
    },

    execute: (data) => {
      const e = new Error('my error')
      e.someProp = 'foo'
      throw e
    }
  }
}
