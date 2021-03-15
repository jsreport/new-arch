import { Fragment, useRef, useMemo, useCallback } from 'react'
import { Handle } from 'react-flow-renderer'
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

  const { operation, reqResInfo } = data
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

  return (
    <Fragment>
      <Handle type='target' position={targetPosition} isConnectable={isConnectable} />
      <div id={id} ref={nodeContentRef}>
        {data.label}
      </div>
      <Handle type='source' position={sourcePosition} isConnectable={isConnectable} />
      {reqResInfo != null && (
        <div className={styles.profilerReqResButtons} style={{ ...reqResInfoPosition }} onClick={(ev) => ev.stopPropagation()}>
          <button
            className={styles.profilerReqResButton}
            style={{ marginRight: '0.5rem' }}
            onClick={handleReqClick}
          >
            req
          </button>
          <button
            className={styles.profilerReqResButton}
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

export default OperationNode
