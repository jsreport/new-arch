import { useCallback, useMemo } from 'react'
import classNames from 'classnames'
import ReactFlow, { Controls } from 'react-flow-renderer'
import styles from './Preview.css'

const OperationsDisplay = (props) => {
  const { activeOperation, operations, onCanvasClick, onOperationClick } = props

  const onElementClick = useCallback((ev, element) => {
    onOperationClick(element.data.operation)
  }, [onOperationClick])

  const elements = useMemo(() => getElementsFromOperations(operations, activeOperation), [operations, activeOperation])

  return (
    <div className={styles.profilerOperations}>
      <ReactFlow
        elements={elements}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        panOnScroll
        selectNodesOnDrag={false}
        onlyRenderVisibleElements={false}
        onElementClick={onElementClick}
        onPaneClick={onCanvasClick}
      >
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  )
}

function getElementsFromOperations (operations, activeOperation) {
  const elements = []
  let prevElement
  let needsEndNode = false

  for (let i = 0; i < operations.length; i++) {
    const operation = operations[i]
    const isActive = operation.id === activeOperation
    let xValue
    let yValue

    if (operation.previousOperationId != null) {
      const edge = {
        id: `${operation.previousOperationId}-edge-${operation.id}`,
        source: operation.previousOperationId,
        target: operation.id,
        type: 'smoothstep',
        arrowHeadType: 'arrowclosed'
      }

      elements.push(edge)
    }

    if (i === 0) {
      xValue = 100
      yValue = 25
    } else {
      xValue = prevElement.position.x
      yValue = prevElement.position.y + 85
    }

    const nodeClass = classNames(styles.profilerOperationNode, {
      [styles.active]: isActive,
      [styles.running]: !operation.completed && i !== 0
    })

    const node = {
      id: operation.id,
      data: { label: operation.name, operation },
      position: { x: xValue, y: yValue },
      className: nodeClass
    }

    elements.push(node)

    if (i === 0 && operation.completed) {
      needsEndNode = true
    }

    prevElement = node
  }

  if (prevElement != null && needsEndNode) {
    const lastNode = elements[elements.length - 1]

    const endNode = {
      id: `${elements[0].id}-end`,
      data: { label: 'end' },
      position: { x: lastNode.position.x, y: lastNode.position.y + 85 },
      className: styles.profilerOperationNode
    }

    elements.push(endNode)

    elements.push({
      id: `${lastNode.id}-edge-${endNode.id}`,
      source: lastNode.id,
      target: endNode.id,
      type: 'smoothstep',
      arrowHeadType: 'arrowclosed'
    })
  }

  return elements
}

export default OperationsDisplay
