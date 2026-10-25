// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { usePaginatedBooks } from '../src/hooks/usePaginatedBooks'

const book = (id) => ({ id, title: id })
const page = (ids, nextStartIndex, hasMore = true) => ({ items: ids.map(book), nextStartIndex, hasMore })

function deferred() {
  let resolve, reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('usePaginatedBooks', () => {
  it('appends pages, removes duplicate IDs and uses nextStartIndex', async () => {
    const calls = []
    const fetchPage = (start) => {
      calls.push(start)
      return Promise.resolve(start === 0 ? page(['a', 'b'], 2) : page(['b', 'c'], 4, false))
    }
    const { result } = renderHook(() => usePaginatedBooks(fetchPage, 'k'))
    await waitFor(() => expect(result.current.status).toBe('success'))
    act(() => result.current.loadMore())
    await waitFor(() => expect(result.current.books.map((b) => b.id)).toEqual(['a', 'b', 'c']))
    expect(calls).toEqual([0, 2])
    expect(result.current.hasMore).toBe(false)
  })

  it('ignores duplicate loadMore calls while a request is pending', async () => {
    let more = 0
    const pending = deferred()
    const fetchPage = (start) => (start === 0 ? Promise.resolve(page(['a'], 1)) : (more++, pending.promise))
    const { result } = renderHook(() => usePaginatedBooks(fetchPage, 'k'))
    await waitFor(() => expect(result.current.status).toBe('success'))
    act(() => {
      result.current.loadMore()
      result.current.loadMore()
    })
    expect(more).toBe(1)
    expect(result.current.loadingMore).toBe(true)
    await act(async () => pending.resolve(page(['b'], 2)))
    expect(result.current.loadingMore).toBe(false)
  })

  it('keeps existing books when a later page fails', async () => {
    const fetchPage = (start) => (start === 0 ? Promise.resolve(page(['a', 'b'], 2)) : Promise.reject(new Error('429')))
    const { result } = renderHook(() => usePaginatedBooks(fetchPage, 'k'))
    await waitFor(() => expect(result.current.status).toBe('success'))
    act(() => result.current.loadMore())
    await waitFor(() => expect(result.current.loadMoreError).toBeTruthy())
    expect(result.current.books.map((b) => b.id)).toEqual(['a', 'b'])
    expect(result.current.status).toBe('success')
  })

  it('resets on key change and ignores outdated responses', async () => {
    const slow = deferred()
    const fetchers = { old: () => slow.promise, new: () => Promise.resolve(page(['new1'], 1)) }
    const { result, rerender } = renderHook(({ k }) => usePaginatedBooks(fetchers[k], k), { initialProps: { k: 'old' } })
    rerender({ k: 'new' })
    await waitFor(() => expect(result.current.status).toBe('success'))
    await act(async () => slow.resolve(page(['old1'], 1)))
    expect(result.current.books.map((b) => b.id)).toEqual(['new1'])
  })

  it('does not fetch when disabled (e.g. empty search)', () => {
    let called = false
    const { result } = renderHook(() => usePaginatedBooks(() => ((called = true), Promise.resolve(page([], 0))), '', { enabled: false }))
    expect(called).toBe(false)
    expect(result.current.status).toBe('idle')
  })
})
