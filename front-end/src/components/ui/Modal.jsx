import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

// Native <dialog>: focus trapping, Escape-to-close and inert background for free.
export function Modal({ open, onClose, title, children, size = 'md' }) {
  const ref = useRef(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      className={`modal modal-${size}`}
      aria-labelledby="modal-title"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      {open && (
        <div className="modal-content">
          <div className="modal-header">
            <h2 id="modal-title">{title}</h2>
            <button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog">
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  )
}
