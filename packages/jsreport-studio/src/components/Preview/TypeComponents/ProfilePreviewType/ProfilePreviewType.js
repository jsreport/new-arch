import { useState, useCallback } from 'react'
import SplitPane from '../../../common/SplitPane/SplitPane'
import OperationsDisplay from './OperationsDisplay'
import { useDispatch } from 'react-redux'
import LogsDisplay from './LogsDisplay'
import ProfileInspectModal from '../../../Modals/ProfileInspectModal'
import ProfileErrorModal from '../../../Modals/ProfileErrorModal'
import { actions as editorActions } from '../../../../redux/editor'
import storeMethods from '../../../../redux/methods'
import { openModal } from '../../../../helpers/openModal'
import { findTextEditor, selectLine as selectLineInTextEditor } from '../../../../helpers/textEditorInstance'
import getStateAtProfileOperation from '../../../../helpers/getStateAtProfileOperation'

function ProfilePreviewType (props) {
  const { data } = props
  const { template, profileLogs, profileOperations, profileErrors } = data
  const [showErrorModal, setShowErrorModal] = useState(true)
  const [activeElement, setActiveElement] = useState(null)
  const dispatch = useDispatch()

  const openErrorLine = useCallback((error) => {
    dispatch(editorActions.openTab({ shortid: error.entity.shortid })).then(() => {
      setTimeout(() => {
        const entity = storeMethods.getEntityByShortid(error.entity.shortid)
        const contentIsTheSame = entity.content === error.entity.content
        const entityEditor = findTextEditor(error.property === 'content' ? entity._id : `${entity._id}_helpers`)

        if (entityEditor != null && contentIsTheSame) {
          selectLineInTextEditor(entityEditor, { lineNumber: error.lineNumber })
        }
      }, 300)
    })
  }, [dispatch])

  const renderErrorModal = useCallback((error) => {
    const showGoToLineButton = (
      error.entity != null &&
      (error.property === 'content' || error.property === 'helpers') &&
      error.lineNumber != null
    )

    return (
      <ProfileErrorModal
        close={() => setShowErrorModal(false)}
        options={{
          title: 'preview error',
          error,
          containerStyle: { maxWidth: 'none', maxHeight: '320px' },
          renderCustomButtons: showGoToLineButton
            ? () => {
                return (
                  <button
                    className='button confirmation'
                    onClick={() => {
                      openErrorLine(error)
                      setShowErrorModal(false)
                    }}
                  >
                    Go to error line
                  </button>
                )
              }
            : undefined
        }}
      />
    )
  }, [openErrorLine])

  const handleCanvasClick = useCallback(() => {
    setActiveElement(null)
  }, [])

  const handleElementClick = useCallback((meta) => {
    if (!meta.isEdge) {
      if (meta.data.error != null && meta.data.operation == null) {
        openModal(ProfileErrorModal, { error: meta.data.error })
      } else if (meta.data.error != null && meta.data.operation != null) {
        if (
          meta.data.error.entity != null &&
          (meta.data.error.property === 'content' || meta.data.error.property === 'helpers') &&
          meta.data.error.lineNumber != null
        ) {
          openErrorLine(meta.data.error)
        } else {
          openModal(ProfileErrorModal, { error: meta.data.error })
        }
      }

      // click on start node should open inspector
      if (meta.id === 'preview-start') {
        openInspectModal({
          operations: profileOperations,
          template,
          sourceId: meta.data.id,
          targetId: 'none',
          inputId: profileOperations[0].id,
          outputId: null,
          onClose: () => setActiveElement(null)
        })
      }

      if (meta.data.operation == null) {
        return setActiveElement(null)
      }
    } else {
      openInspectModal({
        operations: profileOperations,
        template,
        sourceId: meta.data.edge.source,
        targetId: meta.data.edge.target,
        inputId: meta.data.edge.data.inputId,
        outputId: meta.data.edge.data.outputId,
        onClose: () => setActiveElement(null)
      })
    }

    setActiveElement((prevActiveElement) => {
      if (prevActiveElement != null && prevActiveElement.id === meta.id) {
        return null
      }

      return meta
    })
  }, [profileOperations, template, openErrorLine])

  let activeOperation
  if (activeElement != null && !activeElement.isEdge) {
    activeOperation = activeElement
  }

  return (
    <div className='block'>
      <SplitPane
        primary='second'
        split='horizontal'
        resizerClassName='resizer-horizontal'
        defaultSize={(window.innerHeight * 0.2) + 'px'}
      >
        <OperationsDisplay
          activeElement={activeElement}
          operations={profileOperations}
          errors={profileErrors}
          onCanvasClick={handleCanvasClick}
          onElementClick={handleElementClick}
          renderErrorModal={showErrorModal ? renderErrorModal : undefined}
        />
        <LogsDisplay
          activeOperation={activeOperation}
          logs={profileLogs}
        />
      </SplitPane>
    </div>
  )
}

function openInspectModal ({
  operations,
  template,
  sourceId,
  targetId,
  inputId,
  outputId,
  onClose = () => {}
}) {
  openModal(ProfileInspectModal, {
    data: {
      sourceId,
      targetId,
      template,
      getContent: () => {
        let operationState

        if (outputId == null) {
          operationState = getStateAtProfileOperation(operations, inputId, false)
        } else if (inputId == null) {
          operationState = getStateAtProfileOperation(operations, outputId, true)
        } else {
          operationState = getStateAtProfileOperation(operations, inputId, false)
        }

        return operationState
      }
    },
    onModalClose: onClose
  })
}

export default ProfilePreviewType
