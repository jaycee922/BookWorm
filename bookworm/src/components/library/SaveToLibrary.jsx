import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { BookmarkCheck, BookmarkPlus, LogIn, Trash2 } from 'lucide-react'
import { useAuth } from '../../context/authContext'
import { READING_STATUSES } from '../../lib/constants'
import { addToLibrary, removeFromLibrary, updateReadingStatus } from '../../services/libraryService'
import { errorMessage } from '../../services/errors'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { Modal } from '../ui/Modal'
import { Spinner } from '../ui/Spinner'

export function SaveToLibrary({ volumeId, item, itemStatus, onItemChange }) {
  const { user } = useAuth()
  const location = useLocation()
  const [newStatus, setNewStatus] = useState('want_to_read')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [promptLogin, setPromptLogin] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)

  async function run(action) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const save = () => {
    if (!user) return setPromptLogin(true)
    run(async () => onItemChange(await addToLibrary(volumeId, newStatus)))
  }

  const changeStatus = (value) => run(async () => onItemChange(await updateReadingStatus(item.id, value)))

  const remove = () =>
    run(async () => {
      await removeFromLibrary(item.id)
      setConfirmRemove(false)
      onItemChange(null)
    })

  if (user && itemStatus === 'loading') {
    return <div className="save-panel"><Spinner /> <span className="muted">Checking your library…</span></div>
  }

  return (
    <div className="save-panel">
      {item ? (
        <>
          <p className="saved-badge"><BookmarkCheck size={18} aria-hidden="true" /> In your library</p>
          <div className="save-controls">
            <label className="sr-only" htmlFor="status-select">Reading status</label>
            <select id="status-select" className="input select" value={item.reading_status} onChange={(e) => changeStatus(e.target.value)} disabled={busy}>
              {READING_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <button type="button" className="btn btn-ghost" onClick={() => setConfirmRemove(true)} disabled={busy}>
              <Trash2 size={18} aria-hidden="true" /> Remove
            </button>
          </div>
        </>
      ) : (
        <div className="save-controls">
          <button type="button" className="btn btn-primary btn-lg" onClick={save} disabled={busy}>
            {busy ? <Spinner /> : <BookmarkPlus size={20} aria-hidden="true" />} Save to Library
          </button>
          {user && (
            <>
              <label className="sr-only" htmlFor="new-status-select">Save as</label>
              <select id="new-status-select" className="input select" value={newStatus} onChange={(e) => setNewStatus(e.target.value)} disabled={busy}>
                {READING_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </>
          )}
        </div>
      )}
      {error && <p className="inline-error" role="alert">{error}</p>}

      <Modal open={promptLogin} onClose={() => setPromptLogin(false)} title="Log in to save books" size="sm">
        <p className="modal-text">Create a free BookWorm account or log in to build your library and share reading logs.</p>
        <div className="modal-actions">
          <Link to="/signup" state={{ from: location }} className="btn btn-ghost">Sign up</Link>
          <Link to="/login" state={{ from: location }} className="btn btn-primary"><LogIn size={18} aria-hidden="true" /> Log in</Link>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmRemove}
        title="Remove from your library?"
        message="Removing this book also permanently deletes every reading log you wrote for it."
        confirmLabel="Remove book"
        busy={busy}
        error={confirmRemove ? error : null}
        onConfirm={remove}
        onCancel={() => setConfirmRemove(false)}
      />
    </div>
  )
}
