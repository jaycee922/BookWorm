import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { BookGrid } from '../components/books/BookGrid'
import { StateMessage } from '../components/ui/StateMessage'
import { usePaginatedBooks } from '../hooks/usePaginatedBooks'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { MAX_QUERY_LENGTH } from '../lib/constants'
import { searchBooksByTitle } from '../services/booksApi'

const SUGGESTIONS = ['Dune', 'Clean Code', 'The Martian', 'Dracula', 'Sapiens']

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = (searchParams.get('q') ?? '').trim().slice(0, MAX_QUERY_LENGTH)
  const [input, setInput] = useState(query)
  const [validation, setValidation] = useState(null)
  useDocumentTitle(query ? `“${query}”` : 'Search')

  // Keep the field in sync with the URL (back/forward navigation, refresh).
  useEffect(() => setInput(query), [query])

  const list = usePaginatedBooks((start) => searchBooksByTitle(query, start), query, { enabled: Boolean(query) })

  function submit(event) {
    event.preventDefault()
    const next = input.trim()
    if (!next) return setValidation('Enter a book title to search.')
    if (next.length > MAX_QUERY_LENGTH) return setValidation(`Titles can be at most ${MAX_QUERY_LENGTH} characters.`)
    setValidation(null)
    setSearchParams({ q: next })
  }

  return (
    <div className="page container">
      <header className="page-header">
        <p className="eyebrow">Search</p>
        <h1 className="page-title">Find a book by title</h1>
      </header>

      <form className="search-form" role="search" onSubmit={submit} noValidate>
        <label htmlFor="title-search" className="sr-only">Book title</label>
        <Search className="search-icon" size={22} aria-hidden="true" />
        <input
          id="title-search"
          type="search"
          className="input search-input"
          placeholder="Search by book title…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={MAX_QUERY_LENGTH}
          autoComplete="off"
          aria-invalid={Boolean(validation)}
          aria-describedby={validation ? 'search-error' : undefined}
        />
        <button type="submit" className="btn btn-primary btn-lg">Search</button>
      </form>
      {validation && <p id="search-error" className="inline-error" role="alert">{validation}</p>}

      {query ? (
        <>
          <p className="results-label">Titles matching <strong>“{query}”</strong></p>
          <BookGrid
            list={list}
            label="results"
            emptyTitle="No titles matched"
            emptyMessage={`We couldn't find a book titled “${query}”. Check the spelling or try a shorter title.`}
          />
        </>
      ) : (
        <StateMessage
          icon={Search}
          title="Search millions of titles"
          message="Searches match book titles only. Try one of these:"
          action={
            <div className="chip-row">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" className="chip" onClick={() => setSearchParams({ q: s })}>{s}</button>
              ))}
            </div>
          }
        />
      )}
    </div>
  )
}
