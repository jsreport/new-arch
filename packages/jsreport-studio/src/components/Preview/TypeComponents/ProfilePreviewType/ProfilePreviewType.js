import { useState, useCallback } from 'react'
import SplitPane from '../../../common/SplitPane/SplitPane'
import OperationsDisplay from './OperationsDisplay'
import { useDispatch } from 'react-redux'
import LogsDisplay from './LogsDisplay'
import ProfileInspectModal from '../../../Modals/ProfileInspectModal'
import ProfileErrorModal from '../../../Modals/ProfileErrorModal'
import { actions as editorActions } from '../../../../redux/editor'
import storeMethods from '../../../../redux/methods'
import { findTextEditor, selectLine as selectLineInTextEditor } from '../../../../helpers/textEditorInstance'
import { modalHandler } from '../../../../lib/configuration'
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
          renderCustomButtons: showGoToLineButton ? () => {
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
          } : undefined
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
        modalHandler.open(ProfileErrorModal, { error: meta.data.error })
      } else if (meta.data.error != null && meta.data.operation != null) {
        if (
          meta.data.error.entity != null &&
          (meta.data.error.property === 'content' || meta.data.error.property === 'helpers') &&
          meta.data.error.lineNumber != null
        ) {
          openErrorLine(meta.data.error)
        } else {
          modalHandler.open(ProfileErrorModal, { error: meta.data.error })
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
      // don't open inspect modal for profile with no req/res information saved
      if (profileOperations[0].req == null || profileOperations[0].res == null) {
        return
      }

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
  modalHandler.open(ProfileInspectModal, {
    data: {
      sourceId,
      targetId,
      template,
      getContent: () => {
        let basedOnCompletedState = false
        let operationWithState
        let result

        if (outputId == null) {
          operationWithState = getStateAtProfileOperation(operations, inputId, false)
        } else if (inputId == null) {
          basedOnCompletedState = true
          operationWithState = getStateAtProfileOperation(operations, outputId, true)
        } else {
          operationWithState = getStateAtProfileOperation(operations, inputId, false)
        }

        if (basedOnCompletedState) {
          result = {
            reqContent: operationWithState.completedReqState,
            reqDiff: operationWithState.completedReq.diff,
            resContent: operationWithState.completedResState,
            resDiff: operationWithState.completedRes.content != null && operationWithState.completedRes.content.encoding === 'diff' ? operationWithState.completedRes.content.content : '',
            resMetaContent: operationWithState.completedResMetaState
          }
        } else {
          result = {
            reqContent: operationWithState.reqState,
            reqDiff: operationWithState.req.diff,
            resContent: operationWithState.resState,
            resDiff: operationWithState.res.content != null && operationWithState.res.content.encoding === 'diff' ? operationWithState.res.content.content : '',
            resMetaContent: operationWithState.resMetaState
          }
        }

        return result
      }
    },
    onModalClose: onClose
  })
}

export default ProfilePreviewType
