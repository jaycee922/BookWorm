import { useSearchParams } from 'react-router-dom'
import { BookGrid } from '../components/books/BookGrid'
import { usePaginatedBooks } from '../hooks/usePaginatedBooks'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { DEFAULT_GENRE, GENRES, GENRE_SLUGS } from '../lib/constants'
import { getGenreBooks } from '../services/booksApi'

export function DiscoverPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requested = searchParams.get('genre')
  const genreSlug = GENRE_SLUGS.includes(requested) ? requested : DEFAULT_GENRE
  const genre = GENRES.find((g) => g.slug === genreSlug)
  useDocumentTitle(`${genre.label} books`)

  // Changing the genre changes the key, which resets pagination and replaces results.
  const list = usePaginatedBooks((start) => getGenreBooks(genreSlug, start), genreSlug)

  return (
    <div className="page container">
      <header className="page-header">
        <p className="eyebrow">Discover</p>
        <h1 className="page-title">{genre.label}</h1>
        <p className="page-subtitle">{genre.tagline}</p>
      </header>

      <div className="genre-picker" role="group" aria-label="Choose a genre">
        {GENRES.map((g) => (
          <button
            key={g.slug}
            type="button"
            className={`chip ${g.slug === genreSlug ? 'active' : ''}`}
            aria-pressed={g.slug === genreSlug}
            onClick={() => setSearchParams({ genre: g.slug })}
          >
            {g.label}
          </button>
        ))}
      </div>

      {requested && !GENRE_SLUGS.includes(requested) && (
        <p className="inline-error" role="alert">“{requested}” isn't a BookWorm genre, so we're showing {genre.label} instead.</p>
      )}

      <BookGrid
        list={list}
        label={`${genre.label} books`}
        emptyTitle={`No ${genre.label} books found`}
        emptyMessage="Google Books didn't return any titles for this genre. Try another shelf."
      />
    </div>
  )
}
