import { beforeEach, describe, expect, it, vi } from 'vitest'

const invoke = vi.fn()
vi.mock('../src/lib/supabaseClient', () => ({ supabase: { functions: { invoke } } }))

const api = await import('../src/services/booksApi')

describe('booksApi', () => {
  beforeEach(() => invoke.mockReset())

  it('routes every request through the books Edge Function', async () => {
    invoke.mockResolvedValue({ data: { data: { items: [], hasMore: false } }, error: null })
    await api.getTechnologyBooks(0)
    await api.searchBooksByTitle('dune', 20)
    await api.getGenreBooks('horror', 40)
    expect(invoke.mock.calls.map((c) => c[0])).toEqual(['books', 'books', 'books'])
    expect(invoke.mock.calls[1][1].body).toEqual({ action: 'search', query: 'dune', startIndex: 20, maxResults: 20 })
    expect(invoke.mock.calls[2][1].body).toMatchObject({ action: 'genre', genre: 'horror', startIndex: 40 })
  })

  it('surfaces function error bodies, including 429', async () => {
    const context = new Response(JSON.stringify({ error: { code: 'RATE_LIMITED', message: 'Slow down' } }), {
      status: 429,
      headers: { 'content-type': 'application/json', 'retry-after': '30' },
    })
    invoke.mockResolvedValue({ data: null, error: { name: 'FunctionsHttpError', context } })
    await expect(api.getTechnologyBooks()).rejects.toMatchObject({ status: 429, code: 'RATE_LIMITED', message: 'Slow down', retryAfter: '30' })
  })

  it('reports network failures without a response', async () => {
    invoke.mockResolvedValue({ data: null, error: { name: 'FunctionsFetchError' } })
    await expect(api.getBook('abcd1234')).rejects.toMatchObject({ code: 'NETWORK_ERROR' })
  })

  it('batches saved-book metadata in groups of 20', async () => {
    invoke.mockImplementation(async (_name, { body } = { body: { ids: [] } }) => ({
      data: { data: { items: body.ids.map((id) => ({ id })), missing: [] } },
      error: null,
    }))
    const ids = Array.from({ length: 45 }, (_, i) => `vol${String(i).padStart(5, '0')}`)
    const books = await api.getBooks(ids)
    expect(invoke.mock.calls.filter((c) => c.length > 0)).toHaveLength(3)
    expect(books.size).toBe(45)
  })
})
