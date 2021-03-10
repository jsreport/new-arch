import { useState, useCallback } from 'react'
import SplitPane from '../../components/common/SplitPane/SplitPane'
import OperationsDisplay from './OperationsDisplay'
import LogsDisplay from './LogsDisplay'
import ProfilerErrorModal from '../Modals/ProfilerErrorModal'
import { modalHandler } from '../../lib/configuration'

const ProfilerContent = (props) => {
  const { operations, logs, errors } = props
  const [activeElement, setActiveElement] = useState(null)

  const handleCanvasClick = useCallback(() => {
    setActiveElement((prevActiveElement) => {
      if (prevActiveElement == null) {
        return prevActiveElement
      }

      return null
    })
  }, [setActiveElement])

  const handleElementClick = useCallback((meta) => {
    if (!meta.isEdge) {
      if (meta.data.error != null) {
        modalHandler.open(ProfilerErrorModal, { error: meta.data.error })
      }

      if (meta.data.operation == null) {
        setActiveElement(null)
        return
      }
    }

    setActiveElement((prevActiveElement) => {
      if (prevActiveElement != null && prevActiveElement.id === meta.id) {
        return null
      } else {
        return meta
      }
    })
  }, [setActiveElement])

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
        onCanvasClick={handleCanvasClick}
        onElementClick={handleElementClick}
      />
      <LogsDisplay
        activeOperation={activeOperation}
        logs={logs}
      />
    </SplitPane>
  )
}

export default ProfilerContent
