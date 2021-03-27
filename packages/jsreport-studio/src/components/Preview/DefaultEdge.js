import classNames from 'classnames'
import { Fragment, useEffect } from 'react'
import { getSmoothStepPath, getMarkerEnd } from 'react-flow-renderer'
import styles from './Preview.css'

const DefaultEdge = (props) => {
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

  useEffect(() => {
    let elId
    let clonedElId

    elId = 'react-flow__arrowclosed'
    clonedElId = `${elId}-active`

    if (document.getElementById(clonedElId) == null) {
      const markerEndEl = document.getElementById(elId)
      const clonedMarkerEndEl = markerEndEl.cloneNode(true)
      clonedMarkerEndEl.id = `${clonedMarkerEndEl.id}-active`
      markerEndEl.parentElement.appendChild(clonedMarkerEndEl)
    }
  }, [])

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

export default DefaultEdge
