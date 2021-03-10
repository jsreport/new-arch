import classNames from 'classnames'
import { Fragment } from 'react'
import { getSmoothStepPath, getMarkerEnd } from 'react-flow-renderer'
import styles from './Preview.css'

const CustomEdge = (props) => {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    arrowHeadType,
    markerEndId
  } = props

  const edgePath = getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })
  const markerEnd = getMarkerEnd(arrowHeadType, markerEndId)
  const expanderClass = classNames('react-flow__edge-path', styles.profilerOperationEdgeExpander)
  const mainClass = classNames('react-flow__edge-path', styles.main)

  return (
    <Fragment>
      <path
        id={`${id}-expander`}
        style={style}
        className={expanderClass}
        d={edgePath}
      />
      <path
        id={id}
        style={style}
        className={mainClass}
        d={edgePath}
        markerEnd={markerEnd}
      />
    </Fragment>
  )
}

export default CustomEdge
