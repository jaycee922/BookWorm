import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/authContext'
import { PageLoader } from '../ui/Spinner'

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <PageLoader label="Checking your session" />
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  return children
}

// Login/signup pages: signed-in users return to where they came from (or their library).
export function GuestOnlyRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <PageLoader label="Checking your session" />
  if (user) {
    const from = location.state?.from
    const target = from ? `${from.pathname}${from.search ?? ''}${from.hash ?? ''}` : '/library'
    return <Navigate to={target} replace />
  }
  return children
}
