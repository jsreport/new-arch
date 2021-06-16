import { useRef } from 'react'
import resolveUrl from '../../../helpers/resolveUrl'

const DownloadProfileAction = ({ data, closeMenu }) => {
  const { profileOperations } = data
  const mainRenderOperation = profileOperations.find((op) => op.startEvent.subtype === 'render')
  const containerRef = useRef(null)

  return (
    <div
      ref={containerRef}
      className={mainRenderOperation ? '' : 'disabled'}
      title='Download profile'
      onClick={() => {
        if (!mainRenderOperation) {
          return
        }

        handleDownload(containerRef, mainRenderOperation.startEvent.profileId)
        closeMenu()
      }}
    >
      <i className='fa fa-download' /><span>Download Profile</span>
    </div>
  )
}

function handleDownload (containerRef, profileId) {
  const downloadEl = document.createElement('a')

  downloadEl.style.display = 'none'
  downloadEl.href = `${window.location.origin}${resolveUrl(`/api/profile/${profileId}`)}`
  downloadEl.download = `${profileId}.jsrprofile`

  containerRef.current.appendChild(downloadEl)

  const evt = new window.MouseEvent('click', {
    bubbles: false,
    cancelable: false,
    view: window
  })

  downloadEl.dispatchEvent(evt)

  containerRef.current.removeChild(downloadEl)
}

export default DownloadProfileAction
