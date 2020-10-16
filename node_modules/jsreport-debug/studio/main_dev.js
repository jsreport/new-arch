import Studio from 'jsreport-studio'

let debug = false
const preview = () => {
  debug = true
  Studio.preview()
}

Studio.addApiSpec({
  options: { debug: { logsToResponse: true, logsToResponseHeader: true } }
})

Studio.addToolbarComponent((props) => (
  <div
    className={'toolbar-button ' + (!props.canRun ? 'disabled' : '')} onClick={() => preview()}>
    <i className='fa fa-bug' /> Debug</div>
))

Studio.initializeListeners.push(() => {
  Studio.previewListeners.push((request, entities) => {
    if (debug) {
      request.options.debug = { logsToResponse: true }
      debug = false

      // in debug the recipe execution ends with logs so we explicetly put here
      // that we want theming
      return { disableTheming: false }
    } else {
      debug = false
    }
  })
})
