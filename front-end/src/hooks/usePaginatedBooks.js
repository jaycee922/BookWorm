import { useCallback, useEffect, useRef, useState } from 'react'

const IDLE = {
  books: [],
  status: 'idle', // idle | loading | success | error
  error: null,
  hasMore: false,
  loadingMore: false,
  loadMoreError: null,
}

function appendUnique(existing, incoming) {
  const seen = new Set(existing.map((b) => b.id))
  const added = incoming.filter((b) => b?.id && !seen.has(b.id) && seen.add(b.id))
  return added.length ? [...existing, ...added] : existing
}

/**
 * Paginated Google Books list (via the Edge Function).
 * - `key` identifies the list; changing it resets pagination and replaces results.
 * - Responses from an outdated key are ignored, so old searches never overwrite new ones.
 * - A failed "load more" keeps the books already shown.
 */
export function usePaginatedBooks(fetchPage, key, { enabled = true } = {}) {
  const [state, setState] = useState(IDLE)
  const fetchRef = useRef(fetchPage)
  const generation = useRef(0)
  const nextIndex = useRef(0)
  const pending = useRef(false)

  useEffect(() => {
    fetchRef.current = fetchPage
  })

  const loadFirstPage = useCallback(() => {
    const current = ++generation.current
    nextIndex.current = 0
    pending.current = true
    setState({ ...IDLE, status: 'loading' })

    fetchRef
      .current(0)
      .then((page) => {
        if (current !== generation.current) return
        nextIndex.current = page.nextStartIndex
        setState({ ...IDLE, status: 'success', books: appendUnique([], page.items ?? []), hasMore: Boolean(page.hasMore) })
      })
      .catch((error) => {
        if (current !== generation.current) return
        setState({ ...IDLE, status: 'error', error })
      })
      .finally(() => {
        if (current === generation.current) pending.current = false
      })
  }, [])

  useEffect(() => {
    if (!enabled) {
      generation.current++
      pending.current = false
      setState(IDLE)
      return
    }
    loadFirstPage()
  }, [key, enabled, loadFirstPage])

  const loadMore = useCallback(() => {
    if (pending.current) return
    const current = generation.current
    pending.current = true
    setState((s) => ({ ...s, loadingMore: true, loadMoreError: null }))

    fetchRef
      .current(nextIndex.current)
      .then((page) => {
        if (current !== generation.current) return
        nextIndex.current = page.nextStartIndex
        setState((s) => ({
          ...s,
          books: appendUnique(s.books, page.items ?? []),
          hasMore: Boolean(page.hasMore),
          loadingMore: false,
        }))
      })
      .catch((error) => {
        if (current !== generation.current) return
        setState((s) => ({ ...s, loadingMore: false, loadMoreError: error }))
      })
      .finally(() => {
        if (current === generation.current) pending.current = false
      })
  }, [])

  return { ...state, loadMore, retry: loadFirstPage }
}
