import { Route, Routes } from 'react-router-dom'
import { GuestOnlyRoute, ProtectedRoute } from './components/auth/ProtectedRoute'
import { Layout } from './components/layout/Layout'
import { StateMessage } from './components/ui/StateMessage'
import { isSupabaseConfigured } from './lib/supabaseClient'
import { BookDetailsPage } from './pages/BookDetailsPage'
import { DiscoverPage } from './pages/DiscoverPage'
import { HomePage } from './pages/HomePage'
import { LibraryPage } from './pages/LibraryPage'
import { LoginPage } from './pages/LoginPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { ProfilePage } from './pages/ProfilePage'
import { SearchPage } from './pages/SearchPage'
import { SignupPage } from './pages/SignupPage'

export default function App() {
  if (!isSupabaseConfigured) {
    return (
      <div className="page container">
        <StateMessage
          variant="error"
          title="BookWorm is not configured"
          message="Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (see .env.example), then restart."
        />
      </div>
    )
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="discover" element={<DiscoverPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="books/:id" element={<BookDetailsPage />} />
        <Route path="login" element={<GuestOnlyRoute><LoginPage /></GuestOnlyRoute>} />
        <Route path="signup" element={<GuestOnlyRoute><SignupPage /></GuestOnlyRoute>} />
        <Route path="library" element={<ProtectedRoute><LibraryPage /></ProtectedRoute>} />
        <Route path="profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
