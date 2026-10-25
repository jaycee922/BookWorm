import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { errorMessage } from '../../services/errors'
import { StateMessage } from '../ui/StateMessage'
import { BookCard, BookCardSkeleton } from './BookCard'
import { Spinner } from '../ui/Spinner'

// Netflix-style horizontal row. `list` is the return value of usePaginatedBooks.
export function BookRow({ id, title, subtitle, list, seeAllTo, emptyMessage = 'No books found.' }) {
  const scroller = useRef(null)
  const headingId = `${id}-heading`

  const scroll = (direction) => {
    const el = scroller.current
    if (el) el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: 'smooth' })
  }

  return (
    <section className="book-row" aria-labelledby={headingId}>
      <div className="row-header">
        <div>
          <h2 id={headingId} className="row-title">{title}</h2>
          {subtitle && <p className="row-subtitle">{subtitle}</p>}
        </div>
        <div className="row-actions">
          {seeAllTo && (
            <Link to={seeAllTo} className="text-link">
              Browse all
            </Link>
          )}
          {list.books.length > 0 && (
            <>
              <button type="button" className="icon-button" onClick={() => scroll(-1)} aria-label={`Scroll ${title} left`}>
                <ChevronLeft size={20} aria-hidden="true" />
              </button>
              <button type="button" className="icon-button" onClick={() => scroll(1)} aria-label={`Scroll ${title} right`}>
                <ChevronRight size={20} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </div>

      {list.status === 'error' ? (
        <StateMessage
          variant="error"
          compact
          title="This row could not load"
          message={errorMessage(list.error)}
          action={<button type="button" className="btn btn-secondary" onClick={list.retry}>Try again</button>}
        />
      ) : list.status === 'success' && list.books.length === 0 ? (
        <StateMessage compact title="Nothing here yet" message={emptyMessage} />
      ) : (
        <div className="row-scroller" ref={scroller}>
          {list.status !== 'success'
            ? Array.from({ length: 8 }, (_, i) => <BookCardSkeleton key={i} />)
            : list.books.map((book) => <BookCard key={book.id} book={book} />)}

          {list.status === 'success' && list.hasMore && (
            <button
              type="button"
              className="load-more-tile"
              onClick={list.loadMore}
              disabled={list.loadingMore}
              aria-label={`Load more ${title} books`}
            >
              {list.loadingMore ? <Spinner size={22} /> : <Plus size={28} aria-hidden="true" />}
              <span>{list.loadingMore ? 'Loading…' : 'Load more'}</span>
            </button>
          )}
        </div>
      )}

      {list.loadMoreError && (
        <p className="inline-error" role="alert">
          {errorMessage(list.loadMoreError)}{' '}
          <button type="button" className="text-button" onClick={list.loadMore}>Retry</button>
        </p>
      )}
    </section>
  )
}
