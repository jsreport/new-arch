import { useEffect, useRef, useCallback, useMemo } from 'react'
import classNames from 'classnames'
import ReactFlow, { Controls, isNode } from 'react-flow-renderer'
import dagre from 'dagre'
import StartNode from './StartNode'
import OperationNode from './OperationNode'
import CustomEdge from './CustomEdge'
import styles from './Preview.css'

const nodeTypes = {
  start: StartNode,
  operation: OperationNode
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
  const firstOperation = elements.find((el) => el.type === 'operation')
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

  if (operations.length > 0) {
    elements.push({
      id: 'preview-start',
      data: {},
      position: defaultPosition,
      type: 'start',
      className: classNames('react-flow__node-default', styles.profilerStartNode)
    })
  }

  const needsEndNode = []

  for (let i = 0; i < operations.length; i++) {
    const operation = operations[i]

    const isOperationActive = activeElement != null ? operation.id === activeElement.id : false

    if (operation.previousOperationId != null) {
      elements.push(createEdge(operation.previousOperationId, operation.id, activeElement))
    }

    if (operation.type === 'render' && operation.completed === true) {
      needsEndNode.push(operation)
    }

    const nodeClass = classNames('react-flow__node-default', styles.profilerOperationNode, {
      [styles.active]: isOperationActive,
      [styles.running]: !operation.completed && operation.type !== 'render'
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
      type: 'operation',
      className: nodeClass
    }

    elements.push(node)

    if (i === 0) {
      elements.push(createEdge('preview-start', operation.id, activeElement))
    }
  }

  for (const operation of needsEndNode) {
    const classArgs = ['react-flow__node-default', styles.profilerOperationNode]
    const isMainRender = operation.previousOperationId == null

    if (isMainRender) {
      classArgs.push({
        [styles.error]: errors.general != null
      })
    }

    const endNodeClass = classNames(...classArgs)

    const endNodeId = `${operation.id}-end`

    const endNode = {
      id: endNodeId,
      data: {
        label: 'end',
        error: isMainRender ? errors.general : undefined,
        reqResInfo: activeElement != null && activeElement.isEdge && activeElement.data.edge.target === endNodeId ? {
          reqState: operation.completedReqState,
          resState: operation.completedResState,
          edge: activeElement.data.edge
        } : undefined
      },
      position: defaultPosition,
      type: 'operation',
      className: endNodeClass
    }

    elements.push(endNode)

    elements.push(createEdge(operation.completedPreviousOperationId, endNodeId, activeElement))
  }

  const dagreGraph = new dagre.graphlib.Graph()

  dagreGraph.setDefaultEdgeLabel(() => ({}))
  dagreGraph.setGraph({ rankdir: 'LR' })

  elements.forEach((el) => {
    if (isNode(el)) {
      const dimensions = { width: 150, height: 50 }

      if (el.type === 'start') {
        dimensions.width = 10
      }

      dagreGraph.setNode(el.id, dimensions)
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

function createEdge (sourceId, targetId, activeElement) {
  const edgeId = `${sourceId}-edge-${targetId}`

  const edgeClass = classNames(styles.profilerOperationEdge, {
    [styles.active]: activeElement != null && edgeId === activeElement.id
  })

  const edge = {
    id: edgeId,
    source: sourceId,
    target: targetId,
    type: 'custom',
    className: edgeClass,
    arrowHeadType: 'arrowclosed'
  }

  return edge
}

export default OperationsDisplay
