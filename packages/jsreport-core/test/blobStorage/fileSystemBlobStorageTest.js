const path = require('path')
const fs = require('fs')
const tmpDir = require('os').tmpdir()
const deleteFiles = require('../util/deleteFiles')
const common = require('./common.js')
const core = require('../../index')

const outputDir = path.join(tmpDir, 'test-output')

describe('fileSystemBlobStorage', () => {
  let reporter

  describe('common', () => {
    beforeEach(async () => {
      deleteFiles(outputDir)

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir)
      }

      reporter = core({ discover: false, blobStorage: { provider: 'fs', dataDirectory: outputDir } })
      await reporter.init()
    })

    afterEach(async () => {
      if (reporter) {
        await reporter.close()
      }
    })

    common(() => reporter.blobStorage)
  })

  describe('when options.allowLocalFilesAccess=false', () => {
    beforeEach(async () => {
      deleteFiles(path.join(tmpDir, 'test-output'))

      if (!fs.existsSync(path.join(tmpDir, 'test-output'))) {
        fs.mkdirSync(path.join(tmpDir, 'test-output'))
      }

      reporter = core({ discover: false, allowLocalFilesAccess: false, blobStorage: { provider: 'fs', dataDirectory: outputDir } })
      await reporter.init()
    })

    afterEach(async () => {
      if (reporter) {
        await reporter.close()
      }
    })

    describe('should now allow blobName as path', () => {
      it('write', async () => {
        return reporter.blobStorage.write('dir/foo', Buffer.from('hula')).should.be.rejectedWith(/blobName can not be a path/)
      })

      it('read', async () => {
        const exec = async () => reporter.blobStorage.read('dir/foo')
        return exec().should.be.rejectedWith(/blobName can not be a path/)
      })

      it('remove', async () => {
        return reporter.blobStorage.remove('dir/foo').should.be.rejectedWith(/blobName can not be a path/)
      })
    })
  })

  describe('when options.allowLocalFilesAccess=true', () => {
    beforeEach(async () => {
      deleteFiles(outputDir)

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir)
      }

      reporter = core({ discover: false, allowLocalFilesAccess: true, blobStorage: { provider: 'fs', dataDirectory: outputDir } })
      await reporter.init()
    })

    afterEach(async () => {
      if (reporter) {
        await reporter.close()
      }
    })

    describe('should not allow blobName as full path', () => {
      it('write', async () => {
        return reporter.blobStorage.write('/dir/foo', Buffer.from('hula')).should.be.rejectedWith(/blobName can not be an absolute path/)
      })

      it('read', async () => {
        const exec = async () => reporter.blobStorage.read('/dir/foo')
        return exec().should.be.rejectedWith(/blobName can not be an absolute path/)
      })

      it('remove', async () => {
        return reporter.blobStorage.remove('/dir/foo').should.be.rejectedWith(/blobName can not be an absolute path/)
      })
    })

    describe('should not allow blobName as relative path that results in path outside blobStorage directory', () => {
      it('write', async () => {
        return reporter.blobStorage.write('../../dir/foo', Buffer.from('hula')).should.be.rejectedWith(/blobName must be a relative path inside blobStorage directory/)
      })

      it('read', async () => {
        const exec = async () => reporter.blobStorage.read('../../dir/foo')
        return exec().should.be.rejectedWith(/blobName must be a relative path inside blobStorage directory/)
      })

      it('remove', async () => {
        return reporter.blobStorage.remove('../../dir/foo').should.be.rejectedWith(/blobName must be a relative path inside blobStorage directory/)
      })
    })

    describe('should work with correct blobName', () => {
      it('write', async () => {
        const blobName = 'dir/foo'

        await reporter.blobStorage.write(blobName, Buffer.from('hula'))

        const targetPath = path.join(outputDir, blobName)

        fs.existsSync(targetPath).should.be.True()
      })

      it('read', async () => {
        const blobName = 'dir/foo'

        await reporter.blobStorage.write(blobName, Buffer.from('hula'))

        const content = await new Promise((resolve, reject) => {
          const stream = reporter.blobStorage.read(blobName)
          const buf = []

          stream.on('data', (chunk) => {
            buf.push(chunk)
          })

          stream.on('end', () => resolve(Buffer.concat(buf).toString()))

          stream.on('error', reject)
        })

        content.should.be.eql('hula')
      })

      it('remove', async () => {
        const blobName = 'dir/foo'

        await reporter.blobStorage.write(blobName, Buffer.from('hula'))

        const targetPath = path.join(outputDir, blobName)

        fs.existsSync(targetPath).should.be.True()

        await reporter.blobStorage.remove(blobName)

        fs.existsSync(targetPath).should.be.False()
      })
    })
  })
})
