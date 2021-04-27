import { useEffect, useRef, useCallback, useMemo } from 'react'
import classNames from 'classnames'
import ReactFlow, { Controls, isNode } from 'react-flow-renderer'
import dagre from 'dagre'
import StartNode from './StartNode'
import OperationNode from './OperationNode'
import DefaultEdge from './DefaultEdge'
import getStateAtOperation from '../../helpers/getStateAtProfilerOperation'
import styles from './Preview.css'

const nodeTypes = {
  start: StartNode,
  operation: OperationNode
}

const edgeTypes = {
  customDefault: DefaultEdge
}

const OperationsDisplay = (props) => {
  const { activeElement, operations, errors, onCanvasClick, onElementClick, renderErrorModal } = props
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
  const mainOperation = operations.find((op) => op.type === 'render')
  const isMainCompleted = mainOperation != null ? mainOperation.completed === true : false

  useEffect(() => {
    if (graphInstanceRef.current == null) {
      return
    }

    setTimeout(() => {
      if (graphInstanceRef.current == null) {
        return
      }

      if (isMainCompleted) {
        graphInstanceRef.current.fitView()
      }
    }, 200)
  }, [isMainCompleted])

  const mainError = isMainCompleted ? getMainError(errors) : undefined

  return (
    <div className={styles.profilerOperations}>
      {mainError && renderErrorModal != null && (
        <div className={styles.profilerOperationsErrorModal}>
          <div className={styles.profilerOperationsErrorModalContent}>
            {renderErrorModal(mainError)}
          </div>
        </div>
      )}
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
  const mainOperation = operations.find((op) => op.type === 'render')
  const isMainCompleted = mainOperation != null ? mainOperation.completed === true : false

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
      elements.push(createEdge(operation.previousOperationId, operation.id, activeElement, {
        data: {
          outputId: operation.previousOperationId,
          inputId: operation.id
        }
      }))
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
        time: operation.completed ? operation.completedTimestamp - operation.timestamp : null,
        timeCost: isMainCompleted ? getTimeCost(operation.completedTimestamp - operation.timestamp, mainOperation.completedTimestamp - mainOperation.timestamp) : null,
        operation,
        error: errorSource
      },
      position: defaultPosition,
      type: 'operation',
      className: nodeClass
    }

    elements.push(node)

    if (i === 0) {
      elements.push(createEdge('preview-start', operation.id, activeElement, {
        data: {
          outputId: null,
          inputId: operation.id
        }
      }))
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
        time: operation.completedTimestamp - operation.timestamp,
        timeCost: isMainCompleted && mainOperation.id !== operation.id ? getTimeCost(operation.completedTimestamp - operation.timestamp, mainOperation.completedTimestamp - mainOperation.timestamp) : null,
        error: errorInRender,
        renderResult: errorInRender == null ? {
          getContent: (operations[0].req == null || operations[0].res == null) ? undefined : () => {
            const state = getStateAtOperation(operations, operation.id, true)

            return {
              content: state.completedResState,
              contentEncoding: operation.completedRes.content.encoding === 'diff' ? 'plain' : operation.completedRes.content.encoding,
              meta: state.completedResMetaState
            }
          }
        } : undefined,
        end: true
      },
      position: defaultPosition,
      type: 'operation',
      className: endNodeClass
    }

    elements.push(endNode)

    elements.push(createEdge(operation.completedPreviousOperationId, endNodeId, activeElement, {
      data: {
        outputId: operation.id,
        inputId: null
      }
    }))
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

function getMainError (errors) {
  if (errors == null) {
    return
  }

  if (errors.global != null) {
    return errors.global
  }

  if (errors.general != null) {
    return errors.general
  }

  if (errors.operations != null) {
    const lastKey = Object.keys(errors.operations).pop()

    if (lastKey != null) {
      return errors.operations[lastKey]
    }
  }
}

function createEdge (sourceId, targetId, activeElement, opts = {}) {
  const edgeId = `${sourceId}-edge-${targetId}`

  const edgeClass = classNames(styles.profilerOperationEdge, {
    [styles.active]: activeElement != null && edgeId === activeElement.id
  })

  const edge = {
    id: edgeId,
    source: sourceId,
    target: targetId,
    type: 'customDefault',
    className: edgeClass,
    arrowHeadType: 'arrowclosed',
    ...opts
  }

  return edge
}

function getTimeCost (cost, totalCost) {
  return cost / totalCost
}

export default OperationsDisplay
