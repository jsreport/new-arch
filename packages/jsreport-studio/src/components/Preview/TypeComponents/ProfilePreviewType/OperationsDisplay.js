import { useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react'
import classNames from 'classnames'
import ReactFlow, { ReactFlowProvider, Controls, isNode } from 'react-flow-renderer'
import dagre from 'dagre'
import StartNode from './StartNode'
import OperationNode from './OperationNode'
import DefaultEdge from './DefaultEdge'
import getStateAtProfileOperation from '../../../../helpers/getStateAtProfileOperation'
import styles from '../../Preview.css'

const nodeTypes = {
  start: StartNode,
  operation: OperationNode
}

const edgeTypes = {
  customDefault: DefaultEdge
}

const OperationsDisplay = (props) => {
  const { templateShortid, activeElement, profileOperations, profileErrorEvent, onCanvasClick, onElementClick, renderErrorModal } = props
  const lastFitViewDisplayRef = useRef(null)
  const graphInstanceRef = useRef(null)

  const handleLoad = useCallback((reactFlowInstance) => {
    graphInstanceRef.current = reactFlowInstance
    lastFitViewDisplayRef.current = null

    let storedViewInfo = window.sessionStorage.getItem('profileCanvasView')

    if (storedViewInfo == null) {
      lastFitViewDisplayRef.current = Date.now()
      return
    }

    storedViewInfo = JSON.parse(storedViewInfo)

    if (storedViewInfo.templateShortid === templateShortid) {
      graphInstanceRef.current.setTransform({ x: storedViewInfo.x, y: storedViewInfo.y, zoom: storedViewInfo.zoom })
    } else {
      window.sessionStorage.removeItem('profileCanvasView')
      lastFitViewDisplayRef.current = Date.now()
    }
  }, [templateShortid])

  const handleElementClick = useCallback((ev, element) => {
    if (isNode(element)) {
      onElementClick({ id: element.id, isEdge: false, data: { operation: element.data.operation, error: element.data.error } })
    } else {
      onElementClick({ id: element.id, isEdge: true, data: { edge: element } })
    }
  }, [onElementClick])

  const elements = useMemo(() => getElementsFromOperations(profileOperations, profileErrorEvent, activeElement), [profileOperations, profileErrorEvent, activeElement])

  const mainRenderOperation = profileOperations.find(o => o.startEvent && o.startEvent.subtype === 'render')
  const isCompleted = mainRenderOperation && (mainRenderOperation.endEvent || profileErrorEvent)

  // handle progressive fit to view in canvas when the profile operations display take long
  useLayoutEffect(() => {
    if (elements.length === 0 || lastFitViewDisplayRef.current == null || isCompleted) {
      return
    }

    const now = Date.now()
    const elapsedTime = now - lastFitViewDisplayRef.current

    if (elapsedTime >= 300) {
      lastFitViewDisplayRef.current = now
      graphInstanceRef.current.fitView({ padding: 0.25 })
    }
  }, [elements, isCompleted])

  // handle the last fit to view when the operations are completed, it also
  // remembers the final canvas view information that the operations produced,
  // so the next preview of same template will start with the same canvas view information
  useEffect(() => {
    if (graphInstanceRef.current == null) {
      return
    }

    const timeoutId = setTimeout(() => {
      if (graphInstanceRef.current == null) {
        return
      }

      if (isCompleted) {
        graphInstanceRef.current.fitView()

        const viewInfo = graphInstanceRef.current.toObject()

        window.sessionStorage.setItem('profileCanvasView', JSON.stringify({
          templateShortid,
          x: viewInfo.position[0],
          y: viewInfo.position[1],
          zoom: viewInfo.zoom
        }))
      }
    }, 200)

    return () => {
      clearTimeout(timeoutId)
    }
  }, [isCompleted, templateShortid])

  return (
    <div className={styles.profileOperations}>
      {profileErrorEvent && renderErrorModal != null && (
        <div className={styles.profileOperationsErrorModal}>
          <div className={styles.profileOperationsErrorModalContent}>
            {renderErrorModal(profileErrorEvent)}
          </div>
        </div>
      )}
      <ReactFlowProvider>
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
      </ReactFlowProvider>
    </div>
  )
}

function getElementsFromOperations (operations, errorEvent, activeElement) {
  const mainRenderOperation = operations.find(o => o.startEvent && o.startEvent.subtype === 'render')

  if (!mainRenderOperation) {
    return []
  }

  const allEvents = [errorEvent, ...operations.map(o => o.startEvent), ...operations.map(o => o.endEvent)].filter(e => e)

  allEvents.sort((a, b) => (a.timestamp - b.timestamp))

  const lastEvent = allEvents[allEvents.length - 1]
  const startTimestamp = mainRenderOperation.startEvent.timestamp
  const endTimestamp = lastEvent.timestamp

  let erroredOperation

  if (errorEvent && errorEvent.previousOperationId) {
    erroredOperation = operations.find(o => o.id === errorEvent.previousOperationId)
  }

  const elements = []
  const defaultPosition = { x: 0, y: 0 }

  if (operations.length > 0) {
    elements.push({
      id: 'preview-start',
      data: {},
      position: defaultPosition,
      type: 'start',
      className: classNames('react-flow__node-default', styles.profileStartNode)
    })
  }

  const needsEndNode = []

  for (let i = 0; i < operations.length; i++) {
    const operation = operations[i]
    const isOperationActive = activeElement != null ? operation.id === activeElement.id : false

    if (operation.previousOperationId != null) {
      elements.push(createEdge(operation.previousOperationId, operation.id, activeElement, {
        data: {
          outputId: operation.previousOperationId,
          inputId: operation.id
        }
      }))
    }

    if (operation.startEvent.subtype === 'render' && operation.endEvent) {
      needsEndNode.push(operation)
    }

    const nodeClass = classNames('react-flow__node-default', styles.profileOperationNode, {
      [styles.active]: isOperationActive,
      // constant blinking of the render operation is a bit annoying, so we don't do that
      // the global error with unknown operation is typically a timeout, so we keep blinking what was running
      [styles.running]: !operation.endEvent && operation.startEvent.subtype !== 'render' && erroredOperation == null,
      [styles.error]: erroredOperation === operation
    })

    const node = {
      id: operation.id,
      data: {
        label: operation.name,
        time: getTime(operation, endTimestamp),
        timeCost: getTimeCost(operation, startTimestamp, endTimestamp),
        operation,
        error: errorEvent
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

  // eslint-disable-next-line
  for (const operation of needsEndNode) {
    const endNodeClass = classNames('react-flow__node-default', styles.profileOperationNode, styles.profileEndNode)
    const endNodeId = `${operation.id}-end`

    const endNode = {
      id: endNodeId,
      data: {
        time: getTime(operation, endTimestamp),
        timeCost: getTimeCost(operation, startTimestamp, endTimestamp),
        renderResult: {
          getContent: () => getStateAtProfileOperation(operations, operation.id, true)
        },
        end: true
      },
      position: defaultPosition,
      type: 'operation',
      className: endNodeClass
    }

    elements.push(endNode)

    elements.push(createEdge(operation.endEvent.previousOperationId, endNodeId, activeElement, {
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

      // we need this little hack to pass a slightly different position
      // in order to notify react flow about the change
      el.position = {
        x: nodeWithPosition.x + Math.random() / 1000,
        y: nodeWithPosition.y
      }
    }

    return el
  })
}

function createEdge (sourceId, targetId, activeElement, opts = {}) {
  const edgeId = `${sourceId}-edge-${targetId}`

  const edgeClass = classNames(styles.profileOperationEdge, {
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

function getTime (operation, endTimestamp) {
  return (operation.endEvent ? operation.endEvent.timestamp : endTimestamp) - operation.startEvent.timestamp
}

function getTimeCost (operation, startTimestamp, endTimestamp) {
  const totalCost = endTimestamp - startTimestamp
  const cost = (operation.endEvent ? operation.endEvent.timestamp : endTimestamp) - operation.startEvent.timestamp
  return cost / totalCost
}

export default OperationsDisplay
