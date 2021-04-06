
const FS = require('fs-extra')

function createDir (absoluteDir) {
  FS.emptydir(absoluteDir)
}

function removeDir (absoluteDir) {
  FS.emptydir(absoluteDir)
}

exports.createDir = createDir
exports.removeDir = removeDir
