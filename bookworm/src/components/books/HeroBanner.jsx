import { Link } from 'react-router-dom'
import { Info, Layers } from 'lucide-react'
import { formatAuthors, publishedYear } from '../../lib/format'
import { BookCover } from './BookCover'

export function HeroBanner({ book, loading }) {
  if (loading || !book) {
    return (
      <section className="hero hero-loading" aria-busy="true" aria-label="Loading featured book">
        <div className="hero-inner">
          <div className="hero-copy">
            <div className="skeleton skeleton-line short" />
            <div className="skeleton skeleton-title" />
            <div className="skeleton skeleton-line" />
            <div className="skeleton skeleton-line" />
          </div>
          <div className="cover skeleton hero-cover" />
        </div>
      </section>
    )
  }

  const year = publishedYear(book.publishedDate)
  return (
    <section className="hero" aria-labelledby="hero-title">
      {book.cover && <div className="hero-backdrop" style={{ backgroundImage: `url("${book.cover}")` }} aria-hidden="true" />}
      <div className="hero-shade" aria-hidden="true" />
      <div className="hero-inner">
        <div className="hero-copy">
          <p className="eyebrow">Featured in Technology</p>
          <h1 id="hero-title" className="hero-title">{book.title}</h1>
          <p className="hero-meta">
            {formatAuthors(book.authors)}
            {year && <span> · {year}</span>}
            {book.pageCount && <span> · {book.pageCount} pages</span>}
          </p>
          {book.hasDescription && <p className="hero-description">{book.description}</p>}
          <div className="hero-actions">
            <Link to={`/books/${encodeURIComponent(book.id)}`} className="btn btn-primary btn-lg">
              <Info size={20} aria-hidden="true" /> View details
            </Link>
            <a href="#technology" className="btn btn-glass btn-lg">
              <Layers size={20} aria-hidden="true" /> Technology collection
            </a>
          </div>
        </div>
        <BookCover book={book} eager className="hero-cover" />
      </div>
    </section>
  )
}
