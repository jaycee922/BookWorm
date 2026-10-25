import { Link } from 'react-router-dom'
import { formatAuthors, publishedYear } from '../../lib/format'
import { BookCover } from './BookCover'

export function BookCard({ book, eager = false }) {
  const year = publishedYear(book.publishedDate)
  return (
    <Link to={`/books/${encodeURIComponent(book.id)}`} className="book-card">
      <BookCover book={book} eager={eager} />
      <div className="book-card-body">
        <h3 className="book-card-title" title={book.title}>{book.title}</h3>
        <p className="book-card-author">{formatAuthors(book.authors)}</p>
        {year && <p className="book-card-meta">{year}</p>}
      </div>
    </Link>
  )
}

export function BookCardSkeleton() {
  return (
    <div className="book-card skeleton-card" aria-hidden="true">
      <div className="cover skeleton" />
      <div className="book-card-body">
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line short" />
      </div>
    </div>
  )
}
