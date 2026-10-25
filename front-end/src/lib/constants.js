// Slugs must match GENRES in supabase/functions/books/lib.ts.
export const GENRES = [
  { slug: 'adventure', label: 'Adventure', tagline: 'Quests, voyages and daring escapes' },
  { slug: 'technology', label: 'Technology', tagline: 'Code, machines and the future' },
  { slug: 'horror', label: 'Horror', tagline: 'Read with the lights on' },
  { slug: 'sci-fi', label: 'Sci-Fi', tagline: 'Worlds beyond our own' },
  { slug: 'fiction', label: 'Fiction', tagline: 'Stories that stay with you' },
  { slug: 'non-fiction', label: 'Non-Fiction', tagline: 'True stories and big ideas' },
]

export const GENRE_SLUGS = GENRES.map((g) => g.slug)
export const DEFAULT_GENRE = 'adventure'

export const READING_STATUSES = [
  { value: 'want_to_read', label: 'Want to Read' },
  { value: 'reading', label: 'Currently Reading' },
  { value: 'finished', label: 'Finished' },
]

export const PAGE_SIZE = 20
export const MAX_QUERY_LENGTH = 100
export const MAX_LOG_LENGTH = 5000
export const MAX_DISPLAY_NAME_LENGTH = 50
