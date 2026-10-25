import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { BookOpen } from 'lucide-react'
import { Spinner } from '../components/ui/Spinner'
import { useAuth } from '../context/authContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { errorMessage } from '../services/errors'

export function LoginPage() {
  useDocumentTitle('Log in')
  const { signIn } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function handleSubmit(event) {
    event.preventDefault()
    if (!email.trim() || !password) return setError('Enter your email and password.')
    setBusy(true)
    setError(null)
    try {
      // On success the session updates and GuestOnlyRoute redirects back.
      await signIn({ email: email.trim(), password })
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <span className="brand-mark lg" aria-hidden="true"><BookOpen size={26} /></span>
        <h1>Welcome back</h1>
        <p className="muted">Log in to manage your library and reading logs.</p>
        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <label className="field-label" htmlFor="login-email">Email</label>
          <input id="login-email" type="email" className="input" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={busy} />
          <label className="field-label" htmlFor="login-password">Password</label>
          <input id="login-password" type="password" className="input" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={busy} />
          {error && <p className="inline-error" role="alert">{error}</p>}
          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>
            {busy && <Spinner />} {busy ? 'Logging in…' : 'Log in'}
          </button>
        </form>
        <p className="auth-switch">
          New to BookWorm? <Link to="/signup" state={location.state}>Create an account</Link>
        </p>
      </div>
    </div>
  )
}
