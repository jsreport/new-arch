import { useState, useCallback } from 'react'
import SplitPane from '../../components/common/SplitPane/SplitPane'
import OperationsDisplay from './OperationsDisplay'
import LogsDisplay from './LogsDisplay'

const ProfilerContent = (props) => {
  const { operations, logs } = props
  const [activeOperation, setActiveOperation] = useState(null)

  const handleCanvasClick = useCallback(() => {
    setActiveOperation((prevActiveOperation) => {
      if (prevActiveOperation == null) {
        return prevActiveOperation
      }

      return null
    })
  }, [setActiveOperation])

  const handleOperationClick = useCallback((operation) => {
    if (operation == null) {
      return
    }

    setActiveOperation((prevActiveOperation) => {
      if (prevActiveOperation === operation.id) {
        return null
      } else {
        return operation.id
      }
    })
  }, [setActiveOperation])

  return (
    <SplitPane
      split='horizontal'
      resizerClassName='resizer-horizontal'
      defaultSize={(window.innerHeight * 0.2) + 'px'}
    >
      <OperationsDisplay
        activeOperation={activeOperation}
        operations={operations}
        onCanvasClick={handleCanvasClick}
        onOperationClick={handleOperationClick}
      />
      <LogsDisplay
        activeOperation={activeOperation}
        logs={logs}
      />
    </SplitPane>
  )
}

export default ProfilerContent
