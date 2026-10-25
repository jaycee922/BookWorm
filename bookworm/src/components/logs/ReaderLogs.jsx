import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { MessageSquareText } from 'lucide-react'
import { useAuth } from '../../context/authContext'
import { createLog, listLogsForBook } from '../../services/logsService'
import { errorMessage } from '../../services/errors'
import { StateMessage } from '../ui/StateMessage'
import { LogForm } from './LogForm'
import { LogItem } from './LogItem'

// Public logs for one volume. Anyone can read; only users who saved the book can write.
export function ReaderLogs({ volumeId, isSaved, refreshKey }) {
  const { user } = useAuth()
  const location = useLocation()
  const [logs, setLogs] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)

  const load = useCallback(() => {
    let active = true
    setStatus('loading')
    listLogsForBook(volumeId)
      .then((rows) => {
        if (!active) return
        setLogs(rows)
        setStatus('success')
      })
      .catch((err) => {
        if (!active) return
        setError(err)
        setStatus('error')
      })
    return () => {
      active = false
    }
  }, [volumeId])

  useEffect(() => load(), [load, refreshKey])

  async function handleCreate(values) {
    const created = await createLog({ volumeId, ...values })
    setLogs((current) => [created, ...current])
    setNotice('Your log was posted.')
  }

  return (
    <section className="reader-logs" aria-labelledby="logs-heading">
      <div className="section-heading">
        <h2 id="logs-heading">Reader Logs</h2>
        {status === 'success' && <span className="pill">{logs.length}</span>}
      </div>

      {!user ? (
        <div className="callout">
          <p>Log in and save this book to share your own reading log.</p>
          <Link to="/login" state={{ from: location }} className="btn btn-secondary btn-sm">Log in</Link>
        </div>
      ) : !isSaved ? (
        <div className="callout">
          <p>Save this book to your library to write a reading log.</p>
        </div>
      ) : (
        <div className="card log-composer">
          <LogForm onSubmit={handleCreate} />
          {notice && <p className="success-text" role="status">{notice}</p>}
        </div>
      )}

      {status === 'loading' && (
        <div className="log-list" aria-busy="true">
          {[0, 1].map((i) => <div key={i} className="skeleton skeleton-log" />)}
        </div>
      )}
      {status === 'error' && (
        <StateMessage
          variant="error"
          compact
          title="Reader logs could not load"
          message={errorMessage(error)}
          action={<button type="button" className="btn btn-secondary btn-sm" onClick={load}>Try again</button>}
        />
      )}
      {status === 'success' && logs.length === 0 && (
        <StateMessage compact icon={MessageSquareText} title="No reader logs yet" message="Be the first to share your thoughts on this book." />
      )}
      {status === 'success' && logs.length > 0 && (
        <div className="log-list">
          {logs.map((log) => (
            <LogItem
              key={log.id}
              log={log}
              isOwner={user?.id === log.user_id}
              onChanged={(updated) => setLogs((current) => current.map((l) => (l.id === updated.id ? updated : l)))}
              onDeleted={(id) => setLogs((current) => current.filter((l) => l.id !== id))}
            />
          ))}
        </div>
      )}
    </section>
  )
}
