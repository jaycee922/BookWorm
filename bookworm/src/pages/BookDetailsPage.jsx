import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, BookX } from 'lucide-react'
import { BookCover } from '../components/books/BookCover'
import { SaveToLibrary } from '../components/library/SaveToLibrary'
import { ReaderLogs } from '../components/logs/ReaderLogs'
import { StateMessage } from '../components/ui/StateMessage'
import { useAuth } from '../context/authContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { formatAuthors, formatPublishedDate } from '../lib/format'
import { getBook } from '../services/booksApi'
import { errorMessage } from '../services/errors'
import { getLibraryItem } from '../services/libraryService'

const VOLUME_ID = /^[A-Za-z0-9_-]{4,40}$/

function DetailsSkeleton() {
  return (
    <div className="details-layout" aria-busy="true" aria-label="Loading book">
      <div className="cover skeleton details-cover" />
      <div className="details-main">
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-line short" />
        <div className="skeleton skeleton-block" />
      </div>
    </div>
  )
}

export function BookDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const validId = VOLUME_ID.test(id ?? '')
  const [state, setState] = useState({ status: 'loading', book: null, error: null })
  const [attempt, setAttempt] = useState(0)
  const [libraryItem, setLibraryItem] = useState(null)
  const [itemStatus, setItemStatus] = useState('idle')
  const [logsKey, setLogsKey] = useState(0)
  const [expanded, setExpanded] = useState(false)
  useDocumentTitle(state.book?.title ?? 'Book details')

  useEffect(() => {
    if (!validId) return undefined
    let active = true
    setState({ status: 'loading', book: null, error: null })
    setExpanded(false)
    getBook(id)
      .then((book) => active && setState({ status: 'success', book, error: null }))
      .catch((error) => active && setState({ status: 'error', book: null, error }))
    return () => {
      active = false
    }
  }, [id, validId, attempt])

  useEffect(() => {
    if (!validId || authLoading) return undefined
    if (!user) {
      setLibraryItem(null)
      setItemStatus('idle')
      return undefined
    }
    let active = true
    setItemStatus('loading')
    getLibraryItem(id)
      .then((item) => {
        if (!active) return
        setLibraryItem(item)
        setItemStatus('success')
      })
      .catch(() => active && setItemStatus('error'))
    return () => {
      active = false
    }
  }, [id, validId, user, authLoading])

  function handleItemChange(item) {
    // A removed book cascades to the user's logs, so refresh the log list.
    if (!item && libraryItem) setLogsKey((k) => k + 1)
    setLibraryItem(item)
  }

  if (!validId || (state.status === 'error' && state.error?.status === 404)) {
    return (
      <div className="page container">
        <StateMessage
          icon={BookX}
          title="Book not found"
          message="We couldn't find that book. It may have been removed from Google Books."
          action={<Link to="/discover" className="btn btn-primary">Discover books</Link>}
        />
      </div>
    )
  }

  const { book } = state
  const facts = book && [
    ['Publisher', book.publisher],
    ['Published', formatPublishedDate(book.publishedDate)],
    ['Pages', book.pageCount?.toLocaleString()],
  ]
  const longDescription = book?.description.length > 700

  return (
    <div className="details-page">
      {book?.cover && <div className="details-backdrop" style={{ backgroundImage: `url("${book.cover}")` }} aria-hidden="true" />}
      <div className="page container">
        <button
          type="button"
          className="back-link"
          // React Router stores the history index; on a direct visit there is nothing to go back to.
          onClick={() => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/'))}
        >
          <ArrowLeft size={18} aria-hidden="true" /> Back
        </button>

        {state.status === 'loading' && <DetailsSkeleton />}
        {state.status === 'error' && (
          <StateMessage
            variant="error"
            title="This book could not load"
            message={errorMessage(state.error)}
            action={<button type="button" className="btn btn-primary" onClick={() => setAttempt((a) => a + 1)}>Try again</button>}
          />
        )}

        {book && (
          <>
            <article className="details-layout">
              <BookCover book={book} eager className="details-cover" />
              <div className="details-main">
                <h1 className="details-title">{book.title}</h1>
                {book.subtitle && <p className="details-subtitle">{book.subtitle}</p>}
                <p className="details-authors">by {formatAuthors(book.authors)}</p>

                <dl className="facts">
                  {facts.map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value ?? 'Unknown'}</dd>
                    </div>
                  ))}
                </dl>

                {book.categories.length > 0 && (
                  <ul className="category-list" aria-label="Categories">
                    {book.categories.map((c) => <li key={c} className="pill">{c}</li>)}
                  </ul>
                )}

                <SaveToLibrary volumeId={book.id} item={libraryItem} itemStatus={itemStatus} onItemChange={handleItemChange} />

                <section className="description" aria-labelledby="about-heading">
                  <h2 id="about-heading">About this book</h2>
                  <p className={`description-text ${longDescription && !expanded ? 'clamped' : ''}`}>{book.description}</p>
                  {longDescription && (
                    <button type="button" className="text-button" onClick={() => setExpanded((e) => !e)} aria-expanded={expanded}>
                      {expanded ? 'Show less' : 'Read more'}
                    </button>
                  )}
                </section>
              </div>
            </article>

            <ReaderLogs volumeId={book.id} isSaved={Boolean(libraryItem)} refreshKey={logsKey} />
          </>
        )}
      </div>
    </div>
  )
}
