import ChangePasswordModal from './ChangePasswordModal.js'
import Studio from 'jsreport-studio'

export default (props) => {
  if (Studio.authentication.user.isAdmin) {
    return <span />
  }

  return (
    <div>
      <a id='changePassword' onClick={() => Studio.openModal(ChangePasswordModal, { entity: Studio.authentication.user })} style={{ cursor: 'pointer' }}> <i className='fa fa-key' />Change password</a>
    </div>
  )
}
