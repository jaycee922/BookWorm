import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { BookOpen, ChevronDown, Library, LogIn, LogOut, Menu, Search, User, X } from 'lucide-react'
import { useAuth } from '../../context/authContext'
import { GENRES } from '../../lib/constants'

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/discover', label: 'Discover' },
  { to: '/search', label: 'Search' },
  { to: '/library', label: 'My Library' },
]

export function Navbar() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [genresOpen, setGenresOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const genresRef = useRef(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close menus on navigation.
  useEffect(() => {
    setMenuOpen(false)
    setGenresOpen(false)
  }, [location.pathname, location.search])

  useEffect(() => {
    if (!genresOpen) return undefined
    const onPointer = (e) => !genresRef.current?.contains(e.target) && setGenresOpen(false)
    const onKey = (e) => e.key === 'Escape' && setGenresOpen(false)
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [genresOpen])

  async function handleLogout() {
    try {
      await signOut()
    } finally {
      navigate('/')
    }
  }

  const displayName = profile?.display_name ?? 'Profile'
  const genreMenu = (
    <ul className="genre-menu" id="genre-menu">
      {GENRES.map((g) => (
        <li key={g.slug}>
          <Link to={`/discover?genre=${g.slug}`}>{g.label}</Link>
        </li>
      ))}
    </ul>
  )

  return (
    <header className={`navbar ${scrolled || menuOpen ? 'solid' : ''}`}>
      <nav className="nav-inner" aria-label="Main">
        <Link to="/" className="brand" aria-label="BookWorm home">
          <span className="brand-mark"><BookOpen size={20} aria-hidden="true" /></span>
          <span className="brand-name">Book<span>Worm</span></span>
        </Link>

        <ul className="nav-links">
          {LINKS.slice(0, 2).map((l) => (
            <li key={l.to}><NavLink to={l.to} end={l.end}>{l.label}</NavLink></li>
          ))}
          <li className="genres-dropdown" ref={genresRef}>
            <button type="button" aria-expanded={genresOpen} aria-controls="genre-menu" onClick={() => setGenresOpen((o) => !o)}>
              Genres <ChevronDown size={16} aria-hidden="true" />
            </button>
            {genresOpen && genreMenu}
          </li>
          {LINKS.slice(2).map((l) => (
            <li key={l.to}><NavLink to={l.to}>{l.label}</NavLink></li>
          ))}
        </ul>

        <div className="nav-account">
          <Link to="/search" className="icon-button nav-search-icon" aria-label="Search books"><Search size={20} aria-hidden="true" /></Link>
          {user ? (
            <>
              <NavLink to="/profile" className="nav-profile">
                <span className="avatar sm" aria-hidden="true">{displayName.charAt(0).toUpperCase()}</span>
                <span className="nav-profile-name">{displayName}</span>
              </NavLink>
              <button type="button" className="btn btn-ghost btn-sm nav-logout" onClick={handleLogout}>
                <LogOut size={16} aria-hidden="true" /> Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm nav-login">Log in</Link>
              <Link to="/signup" className="btn btn-primary btn-sm">Sign up</Link>
            </>
          )}
          <button
            type="button"
            className="icon-button nav-toggle"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div className="mobile-menu" id="mobile-menu">
          <ul>
            {LINKS.map((l) => (
              <li key={l.to}><NavLink to={l.to} end={l.end}>{l.label}</NavLink></li>
            ))}
          </ul>
          <p className="mobile-menu-label">Genres</p>
          <ul className="mobile-genres">
            {GENRES.map((g) => (
              <li key={g.slug}><Link to={`/discover?genre=${g.slug}`}>{g.label}</Link></li>
            ))}
          </ul>
          <div className="mobile-account">
            {user ? (
              <>
                <Link to="/profile" className="btn btn-ghost"><User size={18} aria-hidden="true" /> {displayName}</Link>
                <Link to="/library" className="btn btn-ghost"><Library size={18} aria-hidden="true" /> My Library</Link>
                <button type="button" className="btn btn-secondary" onClick={handleLogout}><LogOut size={18} aria-hidden="true" /> Log out</button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn-ghost"><LogIn size={18} aria-hidden="true" /> Log in</Link>
                <Link to="/signup" className="btn btn-primary">Create account</Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
