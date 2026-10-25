import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { formatDate } from '../../lib/format'
import { deleteLog, updateLog } from '../../services/logsService'
import { errorMessage } from '../../services/errors'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { StarDisplay } from '../ui/StarRating'
import { LogForm } from './LogForm'

export function LogItem({ log, isOwner, onChanged, onDeleted }) {
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const author = log.author?.display_name ?? 'Reader'
  const edited = log.updated_at && log.updated_at !== log.created_at

  async function handleSave(values) {
    const updated = await updateLog(log.id, values)
    setEditing(false)
    onChanged(updated)
  }

  async function handleDelete() {
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteLog(log.id)
      setConfirming(false)
      onDeleted(log.id)
    } catch (err) {
      setDeleteError(errorMessage(err))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <article className="log-item">
      <header className="log-header">
        <span className="avatar" aria-hidden="true">{author.charAt(0).toUpperCase()}</span>
        <div className="log-byline">
          <strong>{author}</strong>
          <span className="muted">
            <time dateTime={log.created_at}>{formatDate(log.created_at)}</time>
            {edited && ' · edited'}
          </span>
        </div>
        <StarDisplay rating={log.rating} />
      </header>

      {editing ? (
        <LogForm initial={log} onSubmit={handleSave} onCancel={() => setEditing(false)} submitLabel="Save changes" idPrefix={`edit-${log.id}`} />
      ) : (
        <p className="log-body">{log.body}</p>
      )}

      {isOwner && !editing && (
        <div className="log-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>
            <Pencil size={16} aria-hidden="true" /> Edit
          </button>
          <button type="button" className="btn btn-ghost btn-sm danger-text" onClick={() => setConfirming(true)}>
            <Trash2 size={16} aria-hidden="true" /> Delete
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirming}
        title="Delete this log?"
        message="This reading log will be permanently deleted."
        confirmLabel="Delete log"
        busy={deleting}
        error={deleteError}
        onConfirm={handleDelete}
        onCancel={() => {
          setConfirming(false)
          setDeleteError(null)
        }}
      />
    </article>
  )
}
