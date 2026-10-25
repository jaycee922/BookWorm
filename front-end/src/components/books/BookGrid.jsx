import { SearchX } from 'lucide-react'
import { errorMessage } from '../../services/errors'
import { StateMessage } from '../ui/StateMessage'
import { LoadMoreButton } from '../ui/LoadMoreButton'
import { BookCard, BookCardSkeleton } from './BookCard'

// Responsive grid for search and genre results. `list` comes from usePaginatedBooks.
export function BookGrid({ list, label, emptyTitle = 'No books found', emptyMessage }) {
  if (list.status === 'loading') {
    return (
      <div className="book-grid" aria-busy="true" aria-label={`Loading ${label}`}>
        {Array.from({ length: 12 }, (_, i) => <BookCardSkeleton key={i} />)}
      </div>
    )
  }

  if (list.status === 'error') {
    return (
      <StateMessage
        variant="error"
        title="We couldn't load these books"
        message={errorMessage(list.error)}
        action={<button type="button" className="btn btn-primary" onClick={list.retry}>Try again</button>}
      />
    )
  }

  if (list.status === 'success' && list.books.length === 0) {
    return <StateMessage icon={SearchX} title={emptyTitle} message={emptyMessage} />
  }

  if (list.status !== 'success') return null

  return (
    <>
      <p className="sr-only" aria-live="polite">{`${list.books.length} ${label} shown`}</p>
      <div className="book-grid">
        {list.books.map((book, i) => <BookCard key={book.id} book={book} eager={i < 6} />)}
      </div>
      <LoadMoreButton list={list} label={label} />
    </>
  )
}
