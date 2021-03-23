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
        minZoom={0}
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
    let errorSource

    if (operation.previousOperationId != null) {
      elements.push(createEdge(operation.previousOperationId, operation.id, activeElement))
    }

    if (operation.type === 'render' && operation.completed === true) {
      needsEndNode.push(operation)
    }

    if (errors.operations != null) {
      for (let errorKey of Object.keys(errors.operations)) {
        // error.id is equal to the id of the operation "render" which it belongs
        if (errorKey === operation.id) {
          errorSource = errors.operations[errorKey]
          break
        }
      }
    }

    const nodeClass = classNames('react-flow__node-default', styles.profilerOperationNode, {
      [styles.active]: isOperationActive,
      [styles.running]: !operation.completed && operation.type !== 'render' && errorSource == null,
      [styles.error]: errorSource != null
    })

    const node = {
      id: operation.id,
      data: {
        label: operation.name,
        operation,
        error: errorSource,
        reqResInfo: activeElement != null && activeElement.isEdge && activeElement.data.edge.target === operation.id ? {
          reqState: operation.reqState,
          reqDiff: operation.req.diff,
          resState: operation.resState,
          resMetaState: operation.resMetaState,
          resDiff: operation.res.content != null && operation.res.content.encoding === 'diff' ? operation.res.content.content : '',
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
    let errorSource
    let errorInRender

    if (isMainRender) {
      errorSource = errors.general
    }

    if (errorSource != null) {
      classArgs.push({
        [styles.error]: errorSource != null
      })
    }

    if (errorSource != null) {
      errorInRender = errorSource
    } else if (errors.operations != null) {
      for (let errorKey of Object.keys(errors.operations)) {
        const error = errors.operations[errorKey]

        // error.id is equal to the id of the operation "render" which it belongs
        if (error.id === operation.id) {
          errorInRender = error
          break
        }
      }
    }

    const endNodeClass = classNames(...classArgs, styles.profilerEndNode, {
      [styles.renderError]: errorInRender != null
    })

    const endNodeId = `${operation.id}-end`

    const endNode = {
      id: endNodeId,
      data: {
        error: errorInRender,
        reqResInfo: activeElement != null && activeElement.isEdge && activeElement.data.edge.target === endNodeId ? {
          reqState: operation.completedReqState,
          reqDiff: operation.completedReq.diff,
          resState: operation.completedResState,
          resMetaState: operation.completedResMetaState,
          resDiff: operation.completedRes.content != null && operation.completedRes.content.encoding === 'diff' ? operation.completedRes.content.content : '',
          edge: activeElement.data.edge
        } : undefined,
        output: errorInRender == null ? {
          content: operation.completedResState,
          contentEncoding: operation.completedRes.content.encoding === 'diff' ? 'plain' : operation.completedRes.content.encoding,
          meta: operation.completedResMetaState
        } : undefined,
        end: true
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
