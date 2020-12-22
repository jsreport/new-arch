const removeTagsPlaceholders = require('./removeTagsPlaceholders')
const slides = require('./slides')
const image = require('./image')

module.exports = (files) => {
  slides(files)
  image(files)
  removeTagsPlaceholders(files)
}
