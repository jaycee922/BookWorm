import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { BookOpen, MailCheck } from 'lucide-react'
import { Spinner } from '../components/ui/Spinner'
import { useAuth } from '../context/authContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { MAX_DISPLAY_NAME_LENGTH } from '../lib/constants'
import { errorMessage } from '../services/errors'

const MIN_PASSWORD = 8

function validate({ displayName, email, password, confirm }) {
  if (!displayName.trim()) return 'Choose a display name.'
  if (displayName.trim().length > MAX_DISPLAY_NAME_LENGTH) return `Display names can be at most ${MAX_DISPLAY_NAME_LENGTH} characters.`
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) return 'Enter a valid email address.'
  if (password.length < MIN_PASSWORD) return `Passwords must be at least ${MIN_PASSWORD} characters.`
  if (password !== confirm) return 'Passwords do not match.'
  return null
}

export function SignupPage() {
  useDocumentTitle('Sign up')
  const { signUp } = useAuth()
  const location = useLocation()
  const [form, setForm] = useState({ displayName: '', email: '', password: '', confirm: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [confirmationSent, setConfirmationSent] = useState(false)

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  async function handleSubmit(event) {
    event.preventDefault()
    const problem = validate(form)
    if (problem) return setError(problem)
    setBusy(true)
    setError(null)
    try {
      const { needsConfirmation } = await signUp({
        email: form.email.trim(),
        password: form.password,
        displayName: form.displayName,
      })
      // Without email confirmation, the new session triggers GuestOnlyRoute's redirect.
      if (needsConfirmation) setConfirmationSent(true)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (confirmationSent) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <span className="brand-mark lg" aria-hidden="true"><MailCheck size={26} /></span>
          <h1>Check your inbox</h1>
          <p className="muted">
            We sent a confirmation link to <strong>{form.email.trim()}</strong>. Confirm your email, then log in to start your library.
          </p>
          <Link to="/login" state={location.state} className="btn btn-primary btn-lg btn-block">Go to log in</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <span className="brand-mark lg" aria-hidden="true"><BookOpen size={26} /></span>
        <h1>Create your account</h1>
        <p className="muted">Save books, track your reading and share logs with other readers.</p>
        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <label className="field-label" htmlFor="signup-name">Display name</label>
          <input id="signup-name" className="input" autoComplete="nickname" value={form.displayName} onChange={update('displayName')} maxLength={MAX_DISPLAY_NAME_LENGTH} required disabled={busy} />
          <p className="field-hint">Shown publicly next to your reading logs. Your email is never shown.</p>
          <label className="field-label" htmlFor="signup-email">Email</label>
          <input id="signup-email" type="email" className="input" autoComplete="email" value={form.email} onChange={update('email')} required disabled={busy} />
          <label className="field-label" htmlFor="signup-password">Password</label>
          <input id="signup-password" type="password" className="input" autoComplete="new-password" value={form.password} onChange={update('password')} minLength={MIN_PASSWORD} required disabled={busy} />
          <label className="field-label" htmlFor="signup-confirm">Confirm password</label>
          <input id="signup-confirm" type="password" className="input" autoComplete="new-password" value={form.confirm} onChange={update('confirm')} required disabled={busy} />
          {error && <p className="inline-error" role="alert">{error}</p>}
          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>
            {busy && <Spinner />} {busy ? 'Creating account…' : 'Sign up'}
          </button>
        </form>
        <p className="auth-switch">
          Already a member? <Link to="/login" state={location.state}>Log in</Link>
        </p>
      </div>
    </div>
  )
}
