const extend = require('node.extend.without.arrays')
const vm = require('vm')
const path = require('path')
const process = require('process')

module.exports = (reporter, definition) => {
  reporter.initializeListeners.add('test-listeners', () => {
    reporter.beforeRenderListeners.add('listeners', async (req, res) => {
      const result = await reporter.executeActionInMain('test-beforeRender-listeners', { req, res }, req)
      extend(true, req, result.req)
      extend(true, res, result.res)
    })

    reporter.afterRenderListeners.add('listeners', async (req, res) => {
      const result = await reporter.executeActionInMain('test-afterRender-listeners', { req, res }, req)
      extend(true, req, result.req)
      extend(true, res, result.res)
    })

    reporter.validateRenderListeners.add('listeners', async (req, res) => {
      const result = await reporter.executeActionInMain('test-validateRender-listeners', { req, res }, req)
      extend(true, req, result.req)
      extend(true, res, result.res)
    })

    reporter.afterTemplatingEnginesExecutedListeners.add('listeners', async (req, res) => {
      const result = await reporter.executeActionInMain('test-afterTemplatingEnginesExecuted-listeners', { req, res }, req)
      extend(true, req, result.req)
      extend(true, res, result.res)
    })

    reporter.beforeRenderListeners.insert(0, 'eval-listeners', async (req, res) => {
      const code = await reporter.executeActionInMain('test-beforeRenderEval', {}, req)

      if (code) {
        const script = new vm.Script(`
          ;(function () {
            return ${code}
          })()
       `)

        script.runInThisContext({
          displayErrors: true
        })(req, res, {
          require: (m) => require(path.join(process.cwd(), 'node_modules', m)),
          reporter
        })
      }
    })
  })
}
