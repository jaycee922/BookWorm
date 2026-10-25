import { errorMessage } from '../../services/errors'
import { Spinner } from './Spinner'

export function LoadMoreButton({ list, label = 'books' }) {
  return (
    <div className="load-more">
      {list.loadMoreError && (
        <p className="inline-error" role="alert">{errorMessage(list.loadMoreError)}</p>
      )}
      {list.hasMore ? (
        <button type="button" className="btn btn-secondary btn-lg" onClick={list.loadMore} disabled={list.loadingMore}>
          {list.loadingMore ? <><Spinner /> Loading more…</> : list.loadMoreError ? 'Try again' : `Load more ${label}`}
        </button>
      ) : (
        list.books.length > 0 && <p className="end-of-list">You've reached the end of the shelf.</p>
      )}
    </div>
  )
}
