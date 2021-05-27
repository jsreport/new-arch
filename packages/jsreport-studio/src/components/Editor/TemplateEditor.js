import PropTypes from 'prop-types'
import React, { Component } from 'react'
import TextEditor from './TextEditor.js'
import SplitPane from '../../components/common/SplitPane/SplitPane.js'
import { templateEditorModeResolvers } from '../../lib/configuration.js'

class TemplateEditor extends Component {
  static propTypes = {
    entity: PropTypes.object.isRequired,
    onUpdate: PropTypes.func.isRequired
  }

  constructor (props) {
    super(props)

    this.contentEditorRef = React.createRef()
  }

  resolveTemplateEditorMode (template) {
    // eslint-disable-next-line
    for (const k in templateEditorModeResolvers) {
      const mode = templateEditorModeResolvers[k](template)
      if (mode) {
        return mode
      }
    }

    return null
  }

  render () {
    const { entity, onUpdate } = this.props

    return (
      <SplitPane
        primary='second'
        split='horizontal'
        resizerClassName='resizer-horizontal'
        defaultSize={(window.innerHeight * 0.2) + 'px'}
      >
        <TextEditor
          key={entity._id}
          ref={this.contentEditorRef}
          name={entity._id}
          getFilename={() => entity.name}
          mode={this.resolveTemplateEditorMode(entity) || 'handlebars'}
          onUpdate={(v) => onUpdate(Object.assign({ _id: entity._id }, { content: v }))}
          value={entity.content || ''}
        />
        <TextEditor
          key={entity._id + '_helpers'}
          name={entity._id + '_helpers'}
          getFilename={() => `${entity.name} (helpers)`}
          mode='javascript'
          preventInitialFocus
          onUpdate={(v) => onUpdate(Object.assign({ _id: entity._id }, { helpers: v }))}
          value={entity.helpers || ''}
        />
      </SplitPane>
    )
  }
}

export default TemplateEditor
