import { Fragment, useCallback } from 'react'
import { Handle } from 'react-flow-renderer'
import fileSaver from 'filesaver.js-npm'
import b64toBlob from './b64toBlob'
import styles from './Preview.css'

const OperationNode = (props) => {
  const {
    id,
    data,
    isConnectable,
    targetPosition = 'top',
    sourcePosition = 'bottom'
  } = props

  const { time, timeCost, operation, error, renderResult, end } = data
  const showExecutionTime = end ? time != null : (operation.type !== 'render' && time != null)
  const showTimeCost = end ? timeCost != null : (operation.type !== 'render' && timeCost != null)

  const handleDownloadRenderResultClick = useCallback(async () => {
    if (renderResult == null || renderResult.getContent == null) {
      return
    }

    const renderResultInfo = renderResult.getContent()
    const parsedMeta = JSON.parse(renderResultInfo.meta)
    let blob

    if (renderResultInfo.contentEncoding === 'base64') {
      blob = b64toBlob(renderResultInfo.content, parsedMeta.contentType)
    } else if (renderResultInfo.contentEncoding === 'plain') {
      blob = new Blob([renderResultInfo.content], { type: parsedMeta.contentType })
    }

    if (blob != null) {
      fileSaver.saveAs(blob, `${parsedMeta.reportName}.${parsedMeta.fileExtension}`)
    }
  }, [renderResult])

  return (
    <Fragment>
      <Handle type='target' position={targetPosition} isConnectable={isConnectable} />
      <div id={id}>
        {renderResult != null ? (
          <button
            className={`${styles.profilerButtonAction} ${renderResult.getContent == null ? 'disabled' : ''}`}
            title={renderResult.getContent == null ? 'render result not available' : 'download render result'}
            disabled={renderResult.getContent == null}
            onClick={handleDownloadRenderResultClick}
          >
            <i className='fa fa-download' />
          </button>
        ) : (
          error != null && end ? <span className={styles.profilerEndNodeLabel} title='report ended with error'><i className='fa fa-times' /></span> : <span>{data.label}</span>
        )}
      </div>
      <Handle type='source' position={sourcePosition} isConnectable={isConnectable} />
      {showTimeCost && (
        <div
          className={`${styles.profilerExecutionTimeCost} ${getTimeCostCategoryClass(timeCost * 100)}`}
          style={{ width: `${timeCost * 100}%` }}
        >
          &nbsp;
        </div>
      )}
      {showExecutionTime && (
        <Fragment>
          <div className={styles.profilerExecutionTime}>
            <span className={styles.profilerExecutionTimeLabel}>{time}ms</span>
          </div>
          <div className={styles.profilerExecutionTimeCover} title={`${time}ms`}>
            &nbsp;
          </div>
        </Fragment>
      )}
    </Fragment>
  )
}

function getTimeCostCategoryClass (percentageCost) {
  if (percentageCost < 20) {
    return styles.low
  } else if (percentageCost < 60) {
    return styles.medium
  } else {
    return styles.high
  }
}

export default OperationNode
