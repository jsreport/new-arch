import { useCallback, useEffect } from 'react'
import classNames from 'classnames'
import styles from '../../Preview.css'

const LogsDisplay = (props) => {
  const { activeOperation, logs } = props

  const getLogNodeId = useCallback((id) => {
    return `profileLog-${id}`
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
    const relativeTime = `+${prevLog == null ? '0' : String(getRelativeTimestamp(prevLog.timestamp, log.timestamp))}`

    const profileLogItemClass = classNames(styles.profileLogItem, {
      [styles.active]: activeOperation != null && log.previousOperationId === activeOperation.id,
      [styles.notActive]: activeOperation != null && log.previousOperationId !== activeOperation.id
    })

    logsElements.push(
      <div id={getLogNodeId(i)} className={profileLogItemClass} key={i}>
        <span className={styles.profileLogItemLevel}>{log.level}</span>
        <span
          className={styles.profileLogItemTime}
          title={relativeTime}
        >
          {relativeTime}
        </span>
        <span
          className={styles.profileLogItemMessage}
          title={log.message}
        >
          {log.message}
        </span>
      </div>
    )

    prevLog = log
  }

  return (
    <div className={styles.profileLogs}>
      {logsElements}
    </div>
  )
}

export default LogsDisplay
