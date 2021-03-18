/*!
 * Copyright(c) 2014 Jan Blaha
 * FileSystem - blob storage in file system
 */
const path = require('path')
const fs = require('fs')
const fsAsync = require('fs/promises')

module.exports = (options) => {
  let storageDirectory

  if (options.blobStorage.dataDirectory) {
    if (path.isAbsolute(options.blobStorage.dataDirectory)) {
      storageDirectory = options.blobStorage.dataDirectory
    } else {
      storageDirectory = path.join(options.rootDirectory, options.blobStorage.dataDirectory)
    }
  } else {
    storageDirectory = path.join(options.rootDirectory, 'data', 'storage')
  }

  if (!fs.existsSync(storageDirectory)) {
    fs.mkdirSync(storageDirectory, { recursive: true })
  }

  return {
    async write (blobName, buffer) {
      checkPathIsInsideDirectory(options, storageDirectory, blobName)

      const targetPath = path.join(storageDirectory, blobName)
      await fsAsync.mkdir(path.dirname(targetPath), { recursive: true })

      await fsAsync.writeFile(targetPath, buffer)
      return blobName
    },

    read (blobName) {
      checkPathIsInsideDirectory(options, storageDirectory, blobName)
      return fs.createReadStream(path.join(storageDirectory, blobName))
    },

    async remove (blobName) {
      checkPathIsInsideDirectory(options, storageDirectory, blobName)
      return fsAsync.unlink(path.join(storageDirectory, blobName))
    },

    init () {

    }
  }
}

function checkPathIsInsideDirectory (options, directory, blobName) {
  if (options.allowLocalFilesAccess === true) {
    return
  }

  if (path.posix.isAbsolute(blobName) || path.win32.isAbsolute(blobName)) {
    throw new Error('blobName can not be an absolute path')
  }

  const fullPath = path.resolve(directory, blobName)
  const relativePath = path.relative(directory, fullPath)

  if (relativePath === '' || relativePath.startsWith('..')) {
    throw new Error('blobName must be a relative path inside blobStorage directory')
  }
}
