import { Fragment, useRef, useMemo, useCallback } from 'react'
import { Handle } from 'react-flow-renderer'
import fileSaver from 'filesaver.js-npm'
import ProfilerInspectReqResModal from '../Modals/ProfilerInspectReqResModal'
import { modalHandler } from '../../lib/configuration'
import styles from './Preview.css'

const OperationNode = (props) => {
  const {
    id,
    data,
    isConnectable,
    targetPosition = 'top',
    sourcePosition = 'bottom'
  } = props

  const { operation, reqResInfo, output } = data
  const showExecutionTime = operation != null && operation.previousOperationId != null && operation.completed === true
  const nodeContentRef = useRef(null)

  const targetEdgeId = reqResInfo != null ? reqResInfo.edge.id : undefined

  const reqResInfoPosition = useMemo(() => {
    if (nodeContentRef.current == null || targetEdgeId == null) {
      return
    }

    const targetEdgeEl = document.getElementById(targetEdgeId)
    const targetEdgeDimensions = targetEdgeEl.getBoundingClientRect()

    return {
      top: 'calc(-100% - 10px)',
      left: `${(nodeContentRef.current.parentElement.getBoundingClientRect().x - targetEdgeDimensions.x) * -1}px`,
      transform: 'translateX(calc(-50% + 10px))'
    }
  }, [targetEdgeId])

  const handleReqClick = useCallback(() => {
    modalHandler.open(ProfilerInspectReqResModal, { title: 'Request', content: reqResInfo.reqState })
  }, [reqResInfo])

  const handleResClick = useCallback(() => {
    modalHandler.open(ProfilerInspectReqResModal, { title: 'Response', content: reqResInfo.resState })
  }, [reqResInfo])

  const handleDownloadOutputClick = useCallback(async () => {
    if (output == null) {
      return
    }

    const parsedMeta = JSON.parse(output.meta)
    let blob

    if (output.contentEncoding === 'base64') {
      blob = b64toBlob(output.content, parsedMeta.contentType)
    } else if (output.contentEncoding === 'plain') {
      blob = new Blob([output.content], { type: parsedMeta.contentType })
    }

    if (blob != null) {
      fileSaver.saveAs(blob, `${parsedMeta.reportName}.${parsedMeta.fileExtension}`)
    }
  }, [output])

  return (
    <Fragment>
      <Handle type='target' position={targetPosition} isConnectable={isConnectable} />
      <div id={id} ref={nodeContentRef}>
        {output != null ? (
          <button
            className={styles.profilerButtonAction}
            title='download output'
            onClick={handleDownloadOutputClick}
          >
            <i className='fa fa-download' />
          </button>
        ) : (
          <span>{data.label}</span>
        )}
      </div>
      <Handle type='source' position={sourcePosition} isConnectable={isConnectable} />
      {reqResInfo != null && (
        <div className={styles.profilerReqResButtons} style={{ ...reqResInfoPosition }} onClick={(ev) => ev.stopPropagation()}>
          <button
            className={styles.profilerButtonAction}
            style={{ marginRight: '0.5rem' }}
            onClick={handleReqClick}
          >
            req
          </button>
          <button
            className={styles.profilerButtonAction}
            onClick={handleResClick}
          >
            res
          </button>
        </div>
      )}
      {showExecutionTime && (
        <div className={styles.profilerExecutionTime}>
          <span className={styles.profilerExecutionTimeLabel}>{operation.completedTimestamp - operation.timestamp}ms</span>
        </div>
      )}
    </Fragment>
  )
}

function b64toBlob (b64Data, contentType = '', sliceSize = 512) {
  const byteCharacters = atob(b64Data)
  const byteArrays = []

  for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
    const slice = byteCharacters.slice(offset, offset + sliceSize)

    const byteNumbers = new Array(slice.length)
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i)
    }

    const byteArray = new Uint8Array(byteNumbers)
    byteArrays.push(byteArray)
  }

  const blob = new Blob(byteArrays, { type: contentType })
  return blob
}

export default OperationNode
