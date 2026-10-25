import { useState } from 'react'
import { BookOpen } from 'lucide-react'

// Tries the large cover, then the thumbnail, then shows a typographic placeholder.
export function BookCover({ book, eager = false, className = '' }) {
  const sources = [...new Set([book?.cover, book?.thumbnail].filter(Boolean))]
  const [index, setIndex] = useState(0)
  const src = sources[index]

  const handleError = () => setIndex((i) => i + 1)
  // Google sometimes serves a 1x1 placeholder instead of a 404.
  const handleLoad = (event) => {
    if (event.currentTarget.naturalWidth < 10) handleError()
  }

  return (
    <div className={`cover ${className}`}>
      {src ? (
        <img
          key={src}
          src={src}
          alt={`Cover of ${book.title}`}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={handleError}
          onLoad={handleLoad}
        />
      ) : (
        <div className="cover-fallback" role="img" aria-label={`No cover available for ${book?.title ?? 'this book'}`}>
          <BookOpen aria-hidden="true" size={28} />
          <span>{book?.title ?? 'Untitled'}</span>
        </div>
      )}
    </div>
  )
}
