const should = require('should')

module.exports = (storage) => {
  it('write and read', async () => {
    await storage().write('foo', Buffer.from('hula'))

    const stream = await storage().read('foo')

    let content = ''
    stream.on('data', (buf) => (content += buf.toString()))
    stream.resume()

    return new Promise((resolve) => {
      stream.on('end', () => {
        should(content).be.eql('hula')
        resolve()
      })
    })
  })

  it('write and readBuffer', async () => {
    await storage().write('foo', Buffer.from('hula'))
    const buf = await storage().readBuffer('foo')
    buf.toString().should.be.eql('hula')
  })

  it('write remove read should fail', async () => {
    await storage().write('foo', Buffer.from('hula'))
    await storage().remove('foo')

    const stream = await storage().read('foo')

    return new Promise((resolve, reject) => {
      stream.on('error', () => resolve())
      stream.resume()
    })
  })

  it('should work with folders and paths', async () => {
    await storage().write('foldera/folderb/myblob.txt', Buffer.from('hula'))
    const buf = await storage().readBuffer('foldera/folderb/myblob.txt')
    buf.toString().should.be.eql('hula')
  })
}
