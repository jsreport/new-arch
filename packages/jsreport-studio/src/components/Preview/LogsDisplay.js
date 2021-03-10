import { useCallback, useEffect } from 'react'
import classNames from 'classnames'
import styles from './Preview.css'

const LogsDisplay = (props) => {
  const { activeOperation, logs } = props

  const getLogNodeId = useCallback((id) => {
    return `profilerLog-${id}`
  }, [])

  const getRelativeTimestamp = useCallback((prevTimestamp, currentTimestamp) => {
    return currentTimestamp - prevTimestamp
  }, [])

  const logsLength = logs.length
  const logsElements = []
  let prevLog

  useEffect(() => {
    if (activeOperation == null) {
      return
    }

    let foundIndex = -1

    for (let i = 0; i < logs.length; i++) {
      if (activeOperation != null && logs[i].previousOperationId === activeOperation.id) {
        foundIndex = i
        break
      }
    }

    if (foundIndex === -1) {
      return
    }

    const logNode = document.getElementById(getLogNodeId(foundIndex))

    if (logNode == null) {
      return
    }

    logNode.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'start' })
  }, [activeOperation, logs, getLogNodeId])

  for (let i = 0; i < logsLength; i++) {
    const log = logs[i]
    const relatimeTime = `+${prevLog == null ? '0' : String(getRelativeTimestamp(prevLog.timestamp, log.timestamp))}`

    const profilerLogItemClass = classNames(styles.profilerLogItem, {
      [styles.active]: activeOperation != null && log.previousOperationId === activeOperation.id,
      [styles.notActive]: activeOperation != null && log.previousOperationId !== activeOperation.id
    })

    logsElements.push(
      <div id={getLogNodeId(i)} className={profilerLogItemClass} key={i}>
        <span className={styles.profilerLogItemLevel}>{log.level}</span>
        <span
          className={styles.profilerLogItemTime}
          title={relatimeTime}
        >
          {relatimeTime}
        </span>
        <span
          className={styles.profilerLogItemMessage}
          title={log.message}
        >
          {log.message}
        </span>
      </div>
    )

    prevLog = log
  }

  return (
    <div className={styles.profilerLogs}>
      {logsElements}
    </div>
  )
}

export default LogsDisplay
