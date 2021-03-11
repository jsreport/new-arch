import SplitPane from '../../components/common/SplitPane/SplitPane'
import OperationsDisplay from './OperationsDisplay'
import LogsDisplay from './LogsDisplay'

const ProfilerContent = (props) => {
  const { operations, logs, errors, activeElement, onCanvasClick, onElementClick } = props

  let activeOperation

  if (activeElement != null && !activeElement.isEdge) {
    activeOperation = activeElement
  }

  return (
    <SplitPane
      split='horizontal'
      resizerClassName='resizer-horizontal'
      defaultSize={(window.innerHeight * 0.2) + 'px'}
    >
      <OperationsDisplay
        activeElement={activeElement}
        operations={operations}
        errors={errors}
        onCanvasClick={onCanvasClick}
        onElementClick={onElementClick}
      />
      <LogsDisplay
        activeOperation={activeOperation}
        logs={logs}
      />
    </SplitPane>
  )
}

export default ProfilerContent
