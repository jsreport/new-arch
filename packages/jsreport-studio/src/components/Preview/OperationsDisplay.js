import { useEffect, useRef, useCallback, useMemo } from 'react'
import classNames from 'classnames'
import ReactFlow, { Controls, isNode } from 'react-flow-renderer'
import dagre from 'dagre'
import CustomNode from './CustomNode'
import CustomEdge from './CustomEdge'
import styles from './Preview.css'

const nodeTypes = {
  custom: CustomNode
}

const edgeTypes = {
  custom: CustomEdge
}

const OperationsDisplay = (props) => {
  const { activeElement, operations, errors, onCanvasClick, onElementClick } = props
  const graphInstanceRef = useRef(null)

  const handleLoad = useCallback((reactFlowInstance) => {
    graphInstanceRef.current = reactFlowInstance
  }, [])

  const handleElementClick = useCallback((ev, element) => {
    if (isNode(element)) {
      onElementClick({ id: element.id, isEdge: false, data: { operation: element.data.operation, error: element.data.error } })
    } else {
      onElementClick({ id: element.id, isEdge: true, data: { edge: element } })
    }
  }, [onElementClick])

  const elements = useMemo(() => getElementsFromOperations(operations, errors, activeElement), [operations, errors, activeElement])
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
        onLoad={handleLoad}
        onElementClick={handleElementClick}
        onPaneClick={onCanvasClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
      >
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  )
}

function getElementsFromOperations (operations, errors, activeElement) {
  const elements = []
  const defaultPosition = { x: 0, y: 0 }
  let prevElement
  let needsEndNode = false

  for (let i = 0; i < operations.length; i++) {
    const operation = operations[i]
    const isOperationActive = activeElement != null ? operation.id === activeElement.id : false

    if (operation.previousOperationId != null) {
      const edgeId = `${operation.previousOperationId}-edge-${operation.id}`

      const edgeClass = classNames(styles.profilerOperationEdge, {
        [styles.active]: activeElement != null && edgeId === activeElement.id
      })

      const edge = {
        id: edgeId,
        source: operation.previousOperationId,
        target: operation.id,
        type: 'custom',
        className: edgeClass,
        arrowHeadType: 'arrowclosed'
      }

      elements.push(edge)
    }

    const nodeClass = classNames('react-flow__node-default', styles.profilerOperationNode, {
      [styles.active]: isOperationActive,
      [styles.running]: !operation.completed && i !== 0
    })

    const node = {
      id: operation.id,
      data: {
        label: operation.name,
        operation,
        reqResInfo: activeElement != null && activeElement.isEdge && activeElement.data.edge.target === operation.id ? {
          reqState: operation.reqState,
          resState: operation.resState,
          edge: activeElement.data.edge
        } : undefined
      },
      position: defaultPosition,
      type: 'custom',
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

    const endNodeClass = classNames('react-flow__node-default', styles.profilerOperationNode, {
      [styles.error]: errors.general != null
    })

    const endNodeId = `${elements[0].id}-end`

    const endNode = {
      id: endNodeId,
      data: {
        label: 'end',
        error: errors.general,
        reqResInfo: activeElement != null && activeElement.isEdge && activeElement.data.edge.target === endNodeId ? {
          reqState: operations[0].completedReqState,
          resState: operations[0].completedResState,
          edge: activeElement.data.edge
        } : undefined
      },
      position: defaultPosition,
      type: 'custom',
      className: endNodeClass
    }

    elements.push(endNode)

    const edgeId = `${lastNode.id}-edge-${endNodeId}`

    const edgeClass = classNames(styles.profilerOperationEdge, {
      [styles.active]: activeElement != null && edgeId === activeElement.id
    })

    elements.push({
      id: edgeId,
      source: lastNode.id,
      target: endNode.id,
      type: 'custom',
      className: edgeClass,
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
