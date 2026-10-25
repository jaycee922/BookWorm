import { Link } from 'react-router-dom'
import { ArrowRight, Compass, Search } from 'lucide-react'
import { BookRow } from '../components/books/BookRow'
import { HeroBanner } from '../components/books/HeroBanner'
import { usePaginatedBooks } from '../hooks/usePaginatedBooks'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { GENRES } from '../lib/constants'
import { getGenreBooks, getTechnologyBooks } from '../services/booksApi'

const EXTRA_ROWS = [
  { genre: 'sci-fi', title: 'Sci-Fi Worlds', subtitle: 'Starships, AI and futures that feel close' },
  { genre: 'adventure', title: 'Adventure Awaits', subtitle: 'Expeditions, quests and narrow escapes' },
  { genre: 'horror', title: 'After Dark', subtitle: 'Horror for readers who like the lights on' },
]

function GenreBookRow({ genre, title, subtitle }) {
  const list = usePaginatedBooks((start) => getGenreBooks(genre, start), genre)
  return <BookRow id={`row-${genre}`} title={title} subtitle={subtitle} list={list} seeAllTo={`/discover?genre=${genre}`} />
}

function IntroHero() {
  return (
    <section className="hero hero-intro" aria-labelledby="hero-title">
      <div className="hero-shade" aria-hidden="true" />
      <div className="hero-inner">
        <div className="hero-copy">
          <p className="eyebrow">Your next great read</p>
          <h1 id="hero-title" className="hero-title">Stream through stories, ideas and code.</h1>
          <p className="hero-description">Browse technology, explore six genres, build your library and share reading logs.</p>
          <div className="hero-actions">
            <Link to="/discover" className="btn btn-primary btn-lg"><Compass size={20} aria-hidden="true" /> Discover books</Link>
            <Link to="/search" className="btn btn-glass btn-lg"><Search size={20} aria-hidden="true" /> Search titles</Link>
          </div>
        </div>
      </div>
    </section>
  )
}

export function HomePage() {
  useDocumentTitle(null)
  const technology = usePaginatedBooks((start) => getTechnologyBooks(start), 'technology')
  const featured =
    technology.books.find((b) => b.hasDescription && b.cover) ?? technology.books[0] ?? null

  return (
    <div className="home">
      {technology.status === 'error' || (technology.status === 'success' && !featured) ? (
        <IntroHero />
      ) : (
        <HeroBanner book={featured} loading={technology.status !== 'success'} />
      )}

      <div className="home-rows">
        <div id="technology" className="anchor-target">
          <BookRow
            id="row-technology"
            title="The Technology Collection"
            subtitle="Programming, engineering and the ideas shaping tomorrow"
            list={technology}
            seeAllTo="/discover?genre=technology"
          />
        </div>

        <section className="genre-showcase" aria-labelledby="genres-heading">
          <div className="row-header">
            <div>
              <h2 id="genres-heading" className="row-title">Browse by Genre</h2>
              <p className="row-subtitle">Six shelves, endless discoveries</p>
            </div>
          </div>
          <ul className="genre-tiles">
            {GENRES.map((g, i) => (
              <li key={g.slug}>
                <Link to={`/discover?genre=${g.slug}`} className={`genre-tile tone-${i}`}>
                  <span className="genre-tile-name">{g.label}</span>
                  <span className="genre-tile-tagline">{g.tagline}</span>
                  <ArrowRight className="genre-tile-arrow" size={20} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {EXTRA_ROWS.map((row) => (
          <GenreBookRow key={row.genre} {...row} />
        ))}
      </div>
    </div>
  )
}
