import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Library } from 'lucide-react'
import { LibraryCard } from '../components/library/LibraryCard'
import { StateMessage } from '../components/ui/StateMessage'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { READING_STATUSES } from '../lib/constants'
import { getBooks } from '../services/booksApi'
import { errorMessage } from '../services/errors'
import { listLibrary } from '../services/libraryService'

const TAB_VALUES = READING_STATUSES.map((s) => s.value)

export function LibraryPage() {
  useDocumentTitle('My Library')
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = TAB_VALUES.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'want_to_read'
  const [items, setItems] = useState([])
  const [books, setBooks] = useState(new Map())
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)
  const [metadataError, setMetadataError] = useState(null)
  const [notice, setNotice] = useState(null)

  const load = useCallback(async () => {
    setStatus('loading')
    setError(null)
    setMetadataError(null)
    try {
      const rows = await listLibrary() // RLS returns only the signed-in user's rows
      setItems(rows)
      setStatus('success')
      if (rows.length) {
        try {
          setBooks(await getBooks(rows.map((r) => r.volume_id)))
        } catch (err) {
          setMetadataError(err)
        }
      }
    } catch (err) {
      setError(err)
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const visible = items.filter((i) => i.reading_status === activeTab)
  const counts = Object.fromEntries(TAB_VALUES.map((v) => [v, items.filter((i) => i.reading_status === v).length]))

  return (
    <div className="page container">
      <header className="page-header">
        <p className="eyebrow">My Library</p>
        <h1 className="page-title">Your shelves</h1>
        <p className="page-subtitle">Only you can see your library. Your reading logs are public.</p>
      </header>

      <div className="tabs" role="tablist" aria-label="Reading status">
        {READING_STATUSES.map((s) => (
          <button
            key={s.value}
            type="button"
            role="tab"
            id={`tab-${s.value}`}
            aria-selected={activeTab === s.value}
            aria-controls="library-panel"
            className={`tab ${activeTab === s.value ? 'active' : ''}`}
            onClick={() => setSearchParams({ tab: s.value })}
          >
            {s.label} <span className="tab-count">{status === 'success' ? counts[s.value] : '–'}</span>
          </button>
        ))}
      </div>

      {notice && (
        <p className="notice" role="status">
          {notice}
          <button type="button" className="text-button" onClick={() => setNotice(null)}>Dismiss</button>
        </p>
      )}
      {metadataError && (
        <p className="inline-error" role="alert">
          Some book details could not load: {errorMessage(metadataError)}{' '}
          <button type="button" className="text-button" onClick={load}>Retry</button>
        </p>
      )}

      <div id="library-panel" role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
        {status === 'loading' && (
          <div className="library-grid" aria-busy="true">
            {[0, 1, 2].map((i) => <div key={i} className="skeleton skeleton-library" />)}
          </div>
        )}
        {status === 'error' && (
          <StateMessage
            variant="error"
            title="Your library could not load"
            message={errorMessage(error)}
            action={<button type="button" className="btn btn-primary" onClick={load}>Try again</button>}
          />
        )}
        {status === 'success' && visible.length === 0 && (
          <StateMessage
            icon={Library}
            title={items.length === 0 ? 'Your library is empty' : 'Nothing on this shelf yet'}
            message={items.length === 0 ? 'Find a book you love and press “Save to Library”.' : 'Change a book’s reading status to move it here.'}
            action={<Link to="/discover" className="btn btn-primary">Discover books</Link>}
          />
        )}
        {status === 'success' && visible.length > 0 && (
          <div className="library-grid">
            {visible.map((item) => (
              <LibraryCard
                key={item.id}
                item={item}
                book={books.get(item.volume_id)}
                onNotice={setNotice}
                onUpdated={(updated) => setItems((current) => current.map((i) => (i.id === updated.id ? updated : i)))}
                onRemoved={(id) => setItems((current) => current.filter((i) => i.id !== id))}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
