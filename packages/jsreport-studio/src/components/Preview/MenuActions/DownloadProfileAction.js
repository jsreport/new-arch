import { useRef } from 'react'
import resolveUrl from '../../../helpers/resolveUrl'

const DownloadProfileAction = ({ completed, data, closeMenu }) => {
  const { profileOperations, profileErrors } = data
  const mainOperation = profileOperations.find((op) => op.type === 'render')
  const enabled = completed && (profileErrors == null || profileErrors.global == null)
  const containerRef = useRef(null)

  return (
    <div
      ref={containerRef}
      className={enabled ? '' : 'disabled'}
      title='Download profile'
      onClick={() => {
        if (!enabled) {
          return
        }

        handleDownload(containerRef, mainOperation.profileId)
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
  downloadEl.href = `${window.location.origin}${resolveUrl(`/api/profile/${profileId}/content`)}`
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
