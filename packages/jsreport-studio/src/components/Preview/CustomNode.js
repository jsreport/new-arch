import { Fragment, useRef, useMemo, useCallback } from 'react'
import { Handle } from 'react-flow-renderer'
import ProfilerInspectReqResModal from '../Modals/ProfilerInspectReqResModal'
import { modalHandler } from '../../lib/configuration'
import styles from './Preview.css'

const CustomNode = (props) => {
  const {
    id,
    data,
    isConnectable,
    targetPosition = 'top',
    sourcePosition = 'bottom'
  } = props

  const { reqResInfo } = data

  const nodeContentRef = useRef(null)

  const edgeId = reqResInfo != null ? reqResInfo.edge.id : undefined

  const reqResInfoPosition = useMemo(() => {
    if (edgeId == null) {
      return
    }

    return {
      top: 'calc(-100% - 10px)',
      left: 'calc(-50% + 5px)'
    }
  }, [edgeId])

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
    </Fragment>
  )
}

export default CustomNode
