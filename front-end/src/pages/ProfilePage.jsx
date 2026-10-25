import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { Spinner } from '../components/ui/Spinner'
import { useAuth } from '../context/authContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { MAX_DISPLAY_NAME_LENGTH, READING_STATUSES } from '../lib/constants'
import { formatDate } from '../lib/format'
import { errorMessage } from '../services/errors'
import { listLibrary } from '../services/libraryService'
import { listMyLogs } from '../services/logsService'
import { updateDisplayName } from '../services/profileService'

export function ProfilePage() {
  useDocumentTitle('Profile')
  const { user, profile, setProfile, signOut } = useAuth()
  const [name, setName] = useState(profile?.display_name ?? '')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState(null)

  useEffect(() => setName(profile?.display_name ?? ''), [profile?.display_name])

  useEffect(() => {
    let active = true
    Promise.all([listLibrary(), listMyLogs(user.id)])
      .then(([items, logs]) => {
        if (!active) return
        const byStatus = Object.fromEntries(READING_STATUSES.map((s) => [s.value, items.filter((i) => i.reading_status === s.value).length]))
        setStats({ total: items.length, byStatus, logs: logs.length })
      })
      .catch(() => active && setStats({ error: true }))
    return () => {
      active = false
    }
  }, [user.id])

  async function handleSubmit(event) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return setError('Display name cannot be empty.')
    if (trimmed.length > MAX_DISPLAY_NAME_LENGTH) return setError(`Display names can be at most ${MAX_DISPLAY_NAME_LENGTH} characters.`)
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      setProfile(await updateDisplayName(user.id, trimmed))
      setMessage('Display name updated.')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const initial = (profile?.display_name ?? '?').charAt(0).toUpperCase()

  return (
    <div className="page container profile-page">
      <header className="profile-header">
        <span className="avatar xl" aria-hidden="true">{initial}</span>
        <div>
          <p className="eyebrow">Profile</p>
          <h1 className="page-title">{profile?.display_name ?? 'Reader'}</h1>
          <p className="muted">
            {user.email} · Member since {formatDate(user.created_at)}
          </p>
          <p className="field-hint">Your email is private. Other readers only see your display name.</p>
        </div>
      </header>

      <section className="stat-grid" aria-label="Reading stats">
        {stats?.error ? (
          <p className="inline-error">Reading stats could not load.</p>
        ) : (
          [
            ['Books saved', stats?.total],
            ...READING_STATUSES.map((s) => [s.label, stats?.byStatus[s.value]]),
            ['Reading logs', stats?.logs],
          ].map(([label, value]) => (
            <div className="stat" key={label}>
              <span className="stat-value">{value ?? '–'}</span>
              <span className="stat-label">{label}</span>
            </div>
          ))
        )}
      </section>

      <section className="card profile-form-card" aria-labelledby="edit-heading">
        <h2 id="edit-heading">Edit display name</h2>
        <form onSubmit={handleSubmit} className="profile-form" noValidate>
          <label className="field-label" htmlFor="display-name">Display name</label>
          <div className="inline-form">
            <input id="display-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={MAX_DISPLAY_NAME_LENGTH} required disabled={busy} />
            <button type="submit" className="btn btn-primary" disabled={busy || name.trim() === profile?.display_name}>
              {busy && <Spinner />} Save
            </button>
          </div>
          {error && <p className="inline-error" role="alert">{error}</p>}
          {message && <p className="success-text" role="status">{message}</p>}
        </form>
      </section>

      <div className="profile-links">
        <Link to="/library" className="btn btn-secondary">Go to My Library</Link>
        <button type="button" className="btn btn-ghost" onClick={() => signOut().catch(() => {})}>
          <LogOut size={18} aria-hidden="true" /> Log out
        </button>
      </div>
    </div>
  )
}
