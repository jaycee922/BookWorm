import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, NotebookPen, Trash2 } from 'lucide-react'
import { READING_STATUSES } from '../../lib/constants'
import { formatAuthors, formatDate } from '../../lib/format'
import { removeFromLibrary, updateReadingStatus } from '../../services/libraryService'
import { createLog } from '../../services/logsService'
import { errorMessage } from '../../services/errors'
import { BookCover } from '../books/BookCover'
import { LogForm } from '../logs/LogForm'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { Modal } from '../ui/Modal'

export function LibraryCard({ item, book, onUpdated, onRemoved, onNotice }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [writing, setWriting] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const title = book?.title ?? 'Book details unavailable'
  const detailsUrl = `/books/${encodeURIComponent(item.volume_id)}`

  async function changeStatus(value) {
    setBusy(true)
    setError(null)
    try {
      const updated = await updateReadingStatus(item.id, value)
      onUpdated(updated)
      onNotice(`Moved “${title}” to ${READING_STATUSES.find((s) => s.value === value).label}.`)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    setError(null)
    try {
      await removeFromLibrary(item.id)
      setConfirming(false)
      onRemoved(item.id)
      onNotice(`Removed “${title}” and its logs from your library.`)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function submitLog(values) {
    await createLog({ volumeId: item.volume_id, ...values })
    setWriting(false)
    onNotice(`Your log for “${title}” was posted.`)
  }

  return (
    <article className="library-card">
      <Link to={detailsUrl} className="library-cover-link" aria-label={`Open details for ${title}`}>
        <BookCover book={book ?? { title, id: item.volume_id }} />
      </Link>
      <div className="library-card-body">
        <h3 className="library-title"><Link to={detailsUrl}>{title}</Link></h3>
        <p className="muted">{book ? formatAuthors(book.authors) : 'Metadata could not be loaded right now.'}</p>
        <p className="library-saved muted">Saved {formatDate(item.created_at)}</p>

        <label className="field-label sm" htmlFor={`status-${item.id}`}>Reading status</label>
        <select id={`status-${item.id}`} className="input select" value={item.reading_status} onChange={(e) => changeStatus(e.target.value)} disabled={busy}>
          {READING_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>

        <div className="library-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setWriting(true)} disabled={busy}>
            <NotebookPen size={16} aria-hidden="true" /> Write log
          </button>
          <Link to={detailsUrl} className="btn btn-ghost btn-sm"><ExternalLink size={16} aria-hidden="true" /> Details</Link>
          <button type="button" className="btn btn-ghost btn-sm danger-text" onClick={() => setConfirming(true)} disabled={busy}>
            <Trash2 size={16} aria-hidden="true" /> Remove
          </button>
        </div>
        {error && !confirming && <p className="inline-error" role="alert">{error}</p>}
      </div>

      <Modal open={writing} onClose={() => setWriting(false)} title={`Reading log: ${title}`}>
        <LogForm onSubmit={submitLog} onCancel={() => setWriting(false)} idPrefix={`lib-${item.id}`} />
      </Modal>

      <ConfirmDialog
        open={confirming}
        title="Remove from your library?"
        message={`Removing “${title}” also permanently deletes every reading log you wrote for it.`}
        confirmLabel="Remove book"
        busy={busy}
        error={confirming ? error : null}
        onConfirm={remove}
        onCancel={() => {
          setConfirming(false)
          setError(null)
        }}
      />
    </article>
  )
}
