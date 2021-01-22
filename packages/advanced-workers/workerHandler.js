module.exports = async (data, { executeMain }) => {
  return async (data, rid) => {
    await executeMain({
      foo: 'saddd ad saasd sadadasdas re gregegregre gre greger ger g gre greer gr gee rgr geg ere grr gerger ge'
    }, rid)
    return 'ok'
  }
}
