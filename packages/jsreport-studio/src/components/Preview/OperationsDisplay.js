import { useEffect, useRef, useCallback, useMemo } from 'react'
import classNames from 'classnames'
import ReactFlow, { Controls, isNode } from 'react-flow-renderer'
import dagre from 'dagre'
import styles from './Preview.css'

const OperationsDisplay = (props) => {
  const { activeOperation, operations, errors, onCanvasClick, onOperationClick } = props
  const graphInstanceRef = useRef(null)

  const onLoad = useCallback((reactFlowInstance) => {
    graphInstanceRef.current = reactFlowInstance
  }, [])

  const onElementClick = useCallback((ev, element) => {
    onOperationClick({ operation: element.data.operation, error: element.data.error })
  }, [onOperationClick])

  const elements = useMemo(() => getElementsFromOperations(operations, errors, activeOperation), [operations, errors, activeOperation])
  const firstOperation = elements[0]
  const isCompleted = firstOperation != null ? firstOperation.data.operation.completed : false

  useEffect(() => {
    if (graphInstanceRef.current == null) {
      return
    }

    setTimeout(() => {
      if (graphInstanceRef.current == null) {
        return
      }

      if (isCompleted) {
        graphInstanceRef.current.fitView()
      }
    }, 200)
  }, [isCompleted])

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
        defaultZoom={0.8}
        onLoad={onLoad}
        onElementClick={onElementClick}
        onPaneClick={onCanvasClick}
      >
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  )
}

function getElementsFromOperations (operations, errors, activeOperation) {
  const elements = []
  const defaultPosition = { x: 0, y: 0 }
  let prevElement
  let needsEndNode = false

  for (let i = 0; i < operations.length; i++) {
    const operation = operations[i]
    const isActive = operation.id === activeOperation

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

    const nodeClass = classNames(styles.profilerOperationNode, {
      [styles.active]: isActive,
      [styles.running]: !operation.completed && i !== 0
    })

    const node = {
      id: operation.id,
      data: { label: operation.name, operation },
      position: defaultPosition,
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

    const endNodeClass = classNames(styles.profilerOperationNode, {
      [styles.error]: errors.general != null
    })

    const endNode = {
      id: `${elements[0].id}-end`,
      data: { label: 'end', error: errors.general },
      position: defaultPosition,
      className: endNodeClass
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

  const dagreGraph = new dagre.graphlib.Graph()

  dagreGraph.setDefaultEdgeLabel(() => ({}))
  dagreGraph.setGraph({ rankdir: 'LR' })

  elements.forEach((el) => {
    if (isNode(el)) {
      dagreGraph.setNode(el.id, { width: 150, height: 50 })
    } else {
      dagreGraph.setEdge(el.source, el.target)
    }
  })

  dagre.layout(dagreGraph)

  return elements.map((el) => {
    if (isNode(el)) {
      const nodeWithPosition = dagreGraph.node(el.id)

      el.targetPosition = 'left'
      el.sourcePosition = 'right'

      // we need this little hack to pass a slighltiy different position
      // in order to notify react flow about the change
      el.position = {
        x: nodeWithPosition.x + Math.random() / 1000,
        y: nodeWithPosition.y
      }
    }

    return el
  })
}

export default OperationsDisplay
