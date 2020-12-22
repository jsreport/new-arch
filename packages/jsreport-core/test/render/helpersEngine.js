
module.exports = () => {
  return {
    compile: (html) => html,
    execute: (html, helpers) => {
      return helpers.a()
    }
  }
}
