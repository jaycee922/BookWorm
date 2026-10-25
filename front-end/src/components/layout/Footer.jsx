import { Link } from 'react-router-dom'
import { BookOpen } from 'lucide-react'

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <Link to="/" className="brand" aria-label="BookWorm home">
          <span className="brand-mark"><BookOpen size={18} aria-hidden="true" /></span>
          <span className="brand-name">Book<span>Worm</span></span>
        </Link>
        <nav aria-label="Footer">
          <ul className="footer-links">
            <li><Link to="/discover">Discover</Link></li>
            <li><Link to="/search">Search</Link></li>
            <li><Link to="/library">My Library</Link></li>
            <li><Link to="/profile">Profile</Link></li>
          </ul>
        </nav>
        <p className="footer-note">Book metadata provided by Google Books.</p>
      </div>
    </footer>
  )
}
