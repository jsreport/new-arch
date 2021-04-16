import React, { useRef, useEffect } from 'react'
import composeRefs from '@seznam/compose-react-refs'

const PreviewActionsMenu = React.forwardRef((props, externalRef) => {
  const { open, actionsComponents, onMenuAction, onRequestClose } = props
  const containerRef = useRef(null)

  useEffect(() => {
    const tryHide = (ev) => {
      let shouldStop = false

      if (ev != null && containerRef.current != null) {
        shouldStop = containerRef.current.parentNode.contains(ev.target)
      }

      if (shouldStop) {
        return
      }

      if (open) {
        onRequestClose()
      }
    }

    const tryHideFromKey = (ev) => {
      // ESC key
      if (ev.which === 27) {
        tryHide()
      }
    }

    window.addEventListener('click', tryHide, true)
    window.addEventListener('keydown', tryHideFromKey)

    return () => {
      window.removeEventListener('click', tryHide, true)
      window.removeEventListener('keydown', tryHideFromKey)
    }
  }, [open, onRequestClose])

  return (
    <div ref={composeRefs(containerRef, externalRef)} className='popup-settings' style={{ display: open ? 'block' : 'none', top: '100%', right: '0' }}>
      {actionsComponents.map((ActionComponent, idx) => (
        React.createElement(ActionComponent, {
          key: idx,
          onMenuAction,
          closeMenu: onRequestClose
        })
      ))}
    </div>
  )
})

export default PreviewActionsMenu
