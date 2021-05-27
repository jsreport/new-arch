import { useEffect, useMemo, useRef } from 'react'
import FrameDisplay from '../FrameDisplay'
import usePrevious from '../../../hooks/usePrevious'
import { reportPreviewStyleResolvers } from '../../../lib/configuration'

const ReportPreviewType = (props) => {
  const { id, data, activeTab, completed } = props
  const { reportSrc, reportFile } = data
  const iframeRef = useRef(null)
  const prevActiveTab = usePrevious(activeTab)

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

  // NOTE: we need this special handling with reload and dataset.firstPaint
  // because it seems that when we load something like a PDF in an iframe and such
  // content is not visible on screen then the pdf viewer just loads as being empty.
  // this happens when you render and the tab is active on profile, when the render finish
  // and you go to report tab you see the pdf viewer empty, this handling fix that behaviour
  // by reloading the iframe when we activate the report tab for the first time after it completed
  useEffect(function refreshFrameFirstPaintMetadata () {
    if (iframeRef.current == null) {
      return
    }

    delete iframeRef.current.dataset.firstPaint
  }, [id])

  useEffect(function handleReloadFrameWhenDuringFirstPaintWasNotVisible () {
    if (!completed || iframeRef.current == null) {
      return
    }

    const firstPaint = iframeRef.current.dataset.firstPaint === '1'

    if (prevActiveTab === 'profile' && activeTab === 'report' && !firstPaint) {
      iframeRef.current.dataset.firstPaint = '1'
      iframeRef.current.contentWindow.location.reload()
    } else if (activeTab === 'report' && !firstPaint) {
      iframeRef.current.dataset.firstPaint = '1'
    }
  }, [completed, prevActiveTab, activeTab])

  return (
    <div className='block'>
      <FrameDisplay
        ref={iframeRef}
        src={reportSrc}
        styles={frameStyles}
      />
    </div>
  )
}

export default ReportPreviewType
