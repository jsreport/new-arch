import Studio from 'jsreport-studio'

const linkModal = (props) => <div>
  <p>
    You can also use browser's http get to render the report template. Just follow this link.
  </p>

  <a href={Studio.rootUrl + '/templates/' + props.options.entity.shortid} target='_blank'>{Studio.rootUrl + '/templates/' + props.options.entity.shortid}</a>
</div>

Studio.addToolbarComponent((props) => {
  if (!props.tab || !props.tab.entity || props.tab.entity.__entitySet !== 'templates') {
    return <span />
  }

  if (Studio.extensions['templates'].options['studio-link-button-visibility'] === false) {
    return <span />
  }

  return <div className='toolbar-button' onClick={() => Studio.openModal(linkModal, {entity: props.tab.entity})}>
    <i className='fa fa-link' />Link
  </div>
})
