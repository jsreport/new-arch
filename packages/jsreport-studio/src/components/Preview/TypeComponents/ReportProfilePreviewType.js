import { Fragment } from 'react'
import ReportPreviewType from './ReportPreviewType'
import ProfilePreviewType from './ProfilePreviewType/ProfilePreviewType'

function ReportProfilePreviewType (props) {
  const { activeTab } = props

  return (
    // eslint-disable-next-line
    <Fragment>
      <div
        className='block'
        style={{ display: activeTab === 'report' ? 'flex' : 'none' }}
      >
        <ReportPreviewType {...props} />
      </div>
      <div
        className='block'
        style={{ display: activeTab === 'profile' ? 'flex' : 'none' }}
      >
        <ProfilePreviewType {...props} />
      </div>
    </Fragment>
  )
}

export default ReportProfilePreviewType
