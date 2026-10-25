import { READING_STATUSES } from './constants'

export function formatAuthors(authors, fallback = 'Unknown author') {
  if (!Array.isArray(authors) || authors.length === 0) return fallback
  if (authors.length <= 2) return authors.join(' & ')
  return `${authors[0]}, ${authors[1]} & ${authors.length - 2} more`
}

export function formatDate(value, options = { year: 'numeric', month: 'short', day: 'numeric' }) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, options)
}

// Google publishedDate can be "2004", "2004-05" or "2004-05-17".
export function formatPublishedDate(value) {
  if (!value) return null
  if (/^\d{4}$/.test(value)) return value
  if (/^\d{4}-\d{2}$/.test(value)) return formatDate(`${value}-01T00:00:00`, { year: 'numeric', month: 'long' })
  return formatDate(`${value}T00:00:00`, { year: 'numeric', month: 'long', day: 'numeric' })
}

export function publishedYear(value) {
  return value?.match(/^\d{4}/)?.[0] ?? null
}

export function statusLabel(value) {
  return READING_STATUSES.find((s) => s.value === value)?.label ?? value
}
