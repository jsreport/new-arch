import { Fragment, useState, useCallback } from 'react'
import { useDispatch } from 'react-redux'
import { Handle } from 'react-flow-renderer'
import fileSaver from 'filesaver.js-npm'
import { actions as progressActions } from '../../../../redux/progress'
import b64toBlob from '../../../../helpers/b64toBlob'
import styles from '../../Preview.css'

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

  const dispatch = useDispatch()

  const [downloading, setDownloading] = useState(false)

  const progressStart = useCallback(() => {
    return dispatch(progressActions.start())
  }, [dispatch])

  const progressStop = useCallback(() => {
    return dispatch(progressActions.stop())
  }, [dispatch])

  const handleDownloadRenderResultClick = useCallback(async () => {
    if (renderResult == null || renderResult.getContent == null || downloading) {
      return
    }

    setDownloading(true)

    progressStart()

    // delay the execution a bit to have a chance to show the animation,
    // this is useful when the downloaded file is a bit big
    setTimeout(() => {
      try {
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
      } finally {
        progressStop()
        setDownloading(false)
      }
    }, 200)
  }, [downloading, renderResult, progressStart, progressStop])

  return (
    // eslint-disable-next-line
    <Fragment>
      <Handle type='target' position={targetPosition} isConnectable={isConnectable} />
      <div id={id}>
        {renderResult != null
          ? (
            <button
              className={`${styles.profileButtonAction} ${renderResult.getContent == null ? 'disabled' : ''}`}
              title={renderResult.getContent == null ? 'render result not available' : 'download render result'}
              disabled={renderResult.getContent == null}
              onClick={handleDownloadRenderResultClick}
            >
              <i className='fa fa-download' />
            </button>
            )
          : (
              error != null && end ? <span className={styles.profileEndNodeLabel} title='report ended with error'><i className='fa fa-times' /></span> : <span>{data.label}</span>
            )}
      </div>
      <Handle type='source' position={sourcePosition} isConnectable={isConnectable} />
      {showTimeCost && (
        <div
          className={`${styles.profileExecutionTimeCost} ${getTimeCostCategoryClass(timeCost * 100)}`}
          style={{ width: `${timeCost * 100}%` }}
        >
          &nbsp;
        </div>
      )}
      {showExecutionTime && (
        // eslint-disable-next-line
        <Fragment>
          <div className={styles.profileExecutionTime}>
            <span className={styles.profileExecutionTimeLabel}>{time}ms</span>
          </div>
          <div className={styles.profileExecutionTimeCover} title={`${time}ms`}>
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
