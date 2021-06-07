import { Fragment } from 'react'
import ReportPreviewType from './ReportPreviewType'
import ProfilePreviewType from './ProfilePreviewType/ProfilePreviewType'

function ReportProfilePreviewType (props) {
  const { activeTab } = props

  // NOTE: we need these styles instead of just display: none
  // because it seems that iframe have weird behaviour when it goes to
  // display none and then display to visible, the content stays invisible,
  // so we need to make the content "invisible" without display: none
  const inactiveStyles = {
    position: 'absolute',
    width: 0,
    height: 0,
    opacity: 0
  }

  return (
    // eslint-disable-next-line
    <Fragment>
      <div
        className='block'
        style={activeTab === 'report' ? undefined : { ...inactiveStyles }}
      >
        <ReportPreviewType {...props} />
      </div>
      <div
        className='block'
        style={activeTab === 'profile' ? undefined : { ...inactiveStyles }}
      >
        <ProfilePreviewType {...props} />
      </div>
    </Fragment>
  )
}

export default ReportProfilePreviewType
