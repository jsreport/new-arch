import React, { useMemo, useRef } from 'react'
import FrameDisplay from '../FrameDisplay'
import { reportPreviewStyleResolvers } from '../../../lib/configuration'

const ReportPreviewType = React.memo(function ReportPreviewType (props) {
  const { data } = props
  const { reportSrc, reportFile } = data
  const iframeRef = useRef(null)

  const frameStyles = useMemo(() => {
    if (reportFile == null) {
      return
    }

    let styles

    // eslint-disable-next-line
    for (const resolver of reportPreviewStyleResolvers) {
      const result = resolver(reportFile)

      if (result != null) {
        styles = result
        break
      }
    }

    return styles
  }, [reportFile])

  return (
    <div className='block'>
      <FrameDisplay
        ref={iframeRef}
        src={reportSrc}
        styles={frameStyles}
      />
    </div>
  )
})

export default ReportPreviewType
