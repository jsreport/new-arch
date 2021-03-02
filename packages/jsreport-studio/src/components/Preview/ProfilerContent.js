import { useState, useCallback } from 'react'
import SplitPane from '../../components/common/SplitPane/SplitPane'
import OperationsDisplay from './OperationsDisplay'
import LogsDisplay from './LogsDisplay'
import ProfilerErrorModal from '../Modals/ProfilerErrorModal'
import { modalHandler } from '../../lib/configuration'

const ProfilerContent = (props) => {
  const { operations, logs, errors } = props
  const [activeOperation, setActiveOperation] = useState(null)

  const handleCanvasClick = useCallback(() => {
    setActiveOperation((prevActiveOperation) => {
      if (prevActiveOperation == null) {
        return prevActiveOperation
      }

      return null
    })
  }, [setActiveOperation])

  const handleOperationClick = useCallback((meta) => {
    if (meta.error != null) {
      modalHandler.open(ProfilerErrorModal, { error: meta.error })
    }

    if (meta.operation == null) {
      setActiveOperation(null)
      return
    }

    setActiveOperation((prevActiveOperation) => {
      if (prevActiveOperation === meta.operation.id) {
        return null
      } else {
        return meta.operation.id
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
        errors={errors}
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
