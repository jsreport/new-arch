import { useRef } from 'react'
import FileInput from '../../common/FileInput/FileInput'
import openProfileFromStreamReader from '../../../helpers/openProfileFromStreamReader'

const UploadProfileAction = ({ completed, closeMenu }) => {
  const uploadProfileInputRef = useRef(null)
  const enabled = completed

  return (
    <div
      className={enabled ? '' : 'disabled'}
      onClick={() => {
        if (!enabled) {
          return
        }

        if (uploadProfileInputRef.current) {
          uploadProfileInputRef.current.openSelection()
        }
      }}
    >
      <i className='fa fa-upload' /><span>Upload Profile</span>
      <div style={{ display: 'none' }}>
        <FileInput
          ref={uploadProfileInputRef}
          onFileSelect={(file) => {
            handleUploadProfile(file)
            closeMenu()
          }}
        />
      </div>
    </div>
  )
}

function handleUploadProfile (file) {
  const profileName = file.name

  openProfileFromStreamReader(() => file.stream().getReader(), {
    name: 'anonymous',
    shortid: null
  }).catch((err) => {
    console.error(`Unable to upload profile "${profileName}"`, err)
  })
}

export default UploadProfileAction
