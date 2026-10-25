import { Modal } from './Modal'
import { Spinner } from './Spinner'

export function ConfirmDialog({ open, title, message, confirmLabel = 'Delete', busy = false, error, onConfirm, onCancel }) {
  return (
    <Modal open={open} onClose={busy ? () => {} : onCancel} title={title} size="sm">
      <p className="modal-text">{message}</p>
      {error && <p className="inline-error" role="alert">{error}</p>}
      <div className="modal-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
        <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={busy}>
          {busy && <Spinner />} {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
