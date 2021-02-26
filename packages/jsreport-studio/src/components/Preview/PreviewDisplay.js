import styles from './Preview.css'

const PreviewDisplay = (props) => {
  const { main, iframeKey, src, containerRef, overlayRef, iframeRef, onLoad } = props
  const mainProps = {}

  if (main) {
    mainProps.id = 'preview'
    mainProps.name = 'previewFrame'
  }

  return (
    <div ref={containerRef} className={`block ${styles.previewDisplayContainer}`}>
      <div ref={overlayRef} style={{ display: 'none' }} />
      <iframe
        key={iframeKey}
        ref={iframeRef}
        frameBorder='0'
        onLoad={onLoad}
        allowFullScreen
        width='100%'
        height='100%'
        src={src == null ? 'about:blank' : src}
        className='block-item'
        {...mainProps}
      />
    </div>
  )
}

export default PreviewDisplay
