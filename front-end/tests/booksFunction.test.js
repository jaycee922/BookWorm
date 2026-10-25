import { describe, expect, it, vi } from 'vitest'
import {
  ApiError,
  GENRES,
  NO_DESCRIPTION,
  corsHeaders,
  handleBooksRequest,
  isOriginAllowed,
  normalizeVolume,
  sanitizeDescription,
  toHttps,
  validateRequest,
} from '../../supabase/functions/books/lib.ts'

const volume = (id, extra = {}) => ({
  id,
  volumeInfo: {
    title: `Book ${id}`,
    authors: ['Ada Lovelace'],
    imageLinks: { thumbnail: `http://books.google.com/books/content?id=${id}&printsec=frontcover&img=1&zoom=1&edge=curl` },
    ...extra,
  },
})

const jsonResponse = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })

function mockFetch(handler) {
  const calls = []
  const fetchImpl = vi.fn(async (url, init) => {
    calls.push(new URL(url))
    return handler(new URL(url), init)
  })
  return { fetchImpl, calls }
}

const expectApiError = async (promise, status, code) => {
  await expect(promise).rejects.toBeInstanceOf(ApiError)
  await promise.catch((e) => {
    expect(e.status).toBe(status)
    if (code) expect(e.code).toBe(code)
  })
}

describe('validateRequest', () => {
  it('rejects unknown actions and non-object bodies', () => {
    expect(() => validateRequest({ action: 'delete' })).toThrow(/action/)
    expect(() => validateRequest(null)).toThrow()
    expect(() => validateRequest([])).toThrow()
  })

  it('rejects missing, empty and oversized search queries', () => {
    expect(() => validateRequest({ action: 'search' })).toThrow(/query/)
    expect(() => validateRequest({ action: 'search', query: '   ' })).toThrow(/empty/)
    expect(() => validateRequest({ action: 'search', query: 'x'.repeat(101) })).toThrow(/at most/)
  })

  it('strips quotes so queries cannot break out of intitle:"..."', () => {
    const req = validateRequest({ action: 'search', query: '  dune" OR subject:horror ' })
    expect(req.query).toBe('dune OR subject:horror')
  })

  it('accepts all six genres and rejects unsupported ones', () => {
    for (const genre of ['adventure', 'technology', 'horror', 'sci-fi', 'fiction', 'non-fiction']) {
      expect(validateRequest({ action: 'genre', genre }).genre).toBe(genre)
    }
    expect(() => validateRequest({ action: 'genre', genre: 'romance' })).toThrow(/genre/)
    expect(() => validateRequest({ action: 'genre', genre: 'toString' })).toThrow(/genre/)
  })

  it('validates pagination bounds (Google max 40 per request)', () => {
    expect(validateRequest({ action: 'technology' })).toMatchObject({ startIndex: 0, maxResults: 20 })
    expect(() => validateRequest({ action: 'technology', maxResults: 41 })).toThrow()
    expect(() => validateRequest({ action: 'technology', maxResults: 0 })).toThrow()
    expect(() => validateRequest({ action: 'technology', startIndex: -1 })).toThrow()
    expect(() => validateRequest({ action: 'technology', startIndex: 1.5 })).toThrow()
    expect(() => validateRequest({ action: 'technology', startIndex: '20' })).toThrow()
  })

  it('validates volume IDs', () => {
    expect(validateRequest({ action: 'volume', id: 'zyTCAlFPjgYC' }).id).toBe('zyTCAlFPjgYC')
    expect(() => validateRequest({ action: 'volume', id: '../../evil' })).toThrow()
    expect(() => validateRequest({ action: 'volume', id: 'abc' })).toThrow()
    expect(() => validateRequest({ action: 'volumes', ids: [] })).toThrow()
    expect(() => validateRequest({ action: 'volumes', ids: Array(21).fill('zyTCAlFPjgYC') })).toThrow()
    expect(validateRequest({ action: 'volumes', ids: ['zyTCAlFPjgYC', 'zyTCAlFPjgYC'] }).ids).toHaveLength(1)
  })
})

describe('normalization', () => {
  it('normalizes cover URLs to HTTPS and removes edge curl', () => {
    const url = toHttps('http://books.google.com/books/content?id=abcd1234&edge=curl')
    expect(url).toMatch(/^https:\/\//)
    expect(url).not.toContain('edge=')
    expect(toHttps('javascript:alert(1)')).toBeNull()
    expect(toHttps(undefined)).toBeNull()
  })

  it('provides safe fallbacks for missing metadata', () => {
    const book = normalizeVolume({ id: 'abcd1234', volumeInfo: {} })
    expect(book).toMatchObject({
      title: 'Untitled',
      authors: [],
      publisher: null,
      pageCount: null,
      categories: [],
      description: NO_DESCRIPTION,
      hasDescription: false,
      thumbnail: null,
      cover: null,
    })
    expect(normalizeVolume({ id: 'bad id!' })).toBeNull()
  })

  it('returns only UI fields (no raw payload passthrough)', () => {
    const book = normalizeVolume({ ...volume('abcd1234'), saleInfo: { secret: 1 }, accessInfo: {} })
    expect(Object.keys(book).sort()).toEqual(
      ['authors', 'averageRating', 'categories', 'cover', 'description', 'hasDescription', 'id', 'pageCount', 'publishedDate', 'publisher', 'subtitle', 'thumbnail', 'title'].sort(),
    )
  })

  it('converts description HTML to plain text', () => {
    const text = sanitizeDescription('<p>Hello <b>world</b></p><script>alert(1)</script><br>Tom &amp; Jerry &#39;quoted&#39;')
    expect(text).not.toMatch(/[<>]/)
    expect(text).toContain('Hello world')
    expect(text).toContain("Tom & Jerry 'quoted'")
  })
})

describe('handleBooksRequest', () => {
  it('uses intitle: for title searches and only calls Google Books', async () => {
    const { fetchImpl, calls } = mockFetch(() => jsonResponse({ totalItems: 1, items: [volume('abcd1234')] }))
    await handleBooksRequest(validateRequest({ action: 'search', query: 'Clean Code' }), { fetchImpl, apiKey: 'k' })
    expect(calls[0].origin).toBe('https://www.googleapis.com')
    expect(calls[0].pathname).toBe('/books/v1/volumes')
    expect(calls[0].searchParams.get('q')).toBe('Clean Code intitle:Clean intitle:Code')
    expect(calls[0].searchParams.get('key')).toBe('k')
  })

  it('maps genres to subject: queries', async () => {
    const { fetchImpl, calls } = mockFetch(() => jsonResponse({ totalItems: 0 }))
    for (const genre of Object.keys(GENRES)) {
      await handleBooksRequest(validateRequest({ action: 'genre', genre }), { fetchImpl })
    }
    expect(calls.map((u) => u.searchParams.get('q'))).toEqual(Object.values(GENRES).map((g) => g.q))
    // Google returns nothing for operator-only queries, so each needs free text before subject:.
    expect(calls.every((u) => /^\S.* subject:/.test(u.searchParams.get('q')))).toBe(true)
  })

  it('paginates with startIndex/maxResults and reports hasMore', async () => {
    const { fetchImpl, calls } = mockFetch(() =>
      jsonResponse({ totalItems: 100, items: [volume('abcd1234'), volume('abcd1234'), volume('efgh5678')] }),
    )
    const page = await handleBooksRequest(validateRequest({ action: 'technology', startIndex: 20, maxResults: 3 }), { fetchImpl })
    expect(calls[0].searchParams.get('startIndex')).toBe('20')
    expect(calls[0].searchParams.get('maxResults')).toBe('3')
    expect(page.items.map((b) => b.id)).toEqual(['abcd1234', 'efgh5678']) // de-duplicated
    expect(page.nextStartIndex).toBe(23)
    expect(page.hasMore).toBe(true)
  })

  it('handles empty pages and reports no more results', async () => {
    const { fetchImpl } = mockFetch(() => jsonResponse({ totalItems: 0 }))
    const page = await handleBooksRequest(validateRequest({ action: 'technology' }), { fetchImpl })
    expect(page).toMatchObject({ items: [], hasMore: false })
  })

  it('filters fiction out of Non-Fiction results', async () => {
    const { fetchImpl } = mockFetch(() =>
      jsonResponse({
        totalItems: 3,
        items: [
          volume('fict0001', { categories: ['Fiction'] }),
          volume('juvn0001', { categories: ['Juvenile Nonfiction'] }),
          volume('hist0001', { categories: ['History'] }),
        ],
      }),
    )
    const page = await handleBooksRequest(validateRequest({ action: 'genre', genre: 'non-fiction' }), { fetchImpl })
    expect(page.items.map((b) => b.id)).toEqual(['juvn0001', 'hist0001'])
    expect(page.nextStartIndex).toBe(3) // pagination still advances past filtered items
  })

  it('maps HTTP 429 to RATE_LIMITED with Retry-After', async () => {
    const { fetchImpl } = mockFetch(() => jsonResponse({}, 429, { 'retry-after': '12' }))
    const promise = handleBooksRequest(validateRequest({ action: 'technology' }), { fetchImpl })
    await expectApiError(promise, 429, 'RATE_LIMITED')
    await promise.catch((e) => expect(e.retryAfter).toBe('12'))
  })

  it('maps timeouts to 504 and network failures to 502', async () => {
    const timeout = vi.fn(async () => {
      throw new DOMException('timed out', 'TimeoutError')
    })
    await expectApiError(handleBooksRequest(validateRequest({ action: 'technology' }), { fetchImpl: timeout }), 504, 'UPSTREAM_TIMEOUT')

    const network = vi.fn(async () => {
      throw new TypeError('fetch failed')
    })
    await expectApiError(handleBooksRequest(validateRequest({ action: 'technology' }), { fetchImpl: network }), 502, 'UPSTREAM_UNAVAILABLE')
  })

  it('aborts slow upstream calls using the timeout signal', async () => {
    const slow = vi.fn((url, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason))))
    await expectApiError(handleBooksRequest(validateRequest({ action: 'technology' }), { fetchImpl: slow, timeoutMs: 20 }), 504)
  })

  it('maps unknown volumes to 404 and upstream 5xx to 502', async () => {
    const notFound = mockFetch(() => jsonResponse({}, 404))
    await expectApiError(handleBooksRequest(validateRequest({ action: 'volume', id: 'abcd1234' }), notFound), 404, 'NOT_FOUND')
    const broken = mockFetch(() => jsonResponse({}, 500))
    await expectApiError(handleBooksRequest(validateRequest({ action: 'technology' }), broken), 502)
  })

  it('returns partial batches and lists missing volumes', async () => {
    const { fetchImpl } = mockFetch((url) =>
      url.pathname.endsWith('good1234') ? jsonResponse(volume('good1234')) : jsonResponse({}, 404),
    )
    const result = await handleBooksRequest(validateRequest({ action: 'volumes', ids: ['good1234', 'gone1234'] }), { fetchImpl })
    expect(result.items.map((b) => b.id)).toEqual(['good1234'])
    expect(result.missing).toEqual(['gone1234'])
  })
})

describe('CORS', () => {
  const allowed = ['https://bookworm.vercel.app', 'https://bookworm-*.vercel.app', 'http://localhost:5173']

  it('allows configured origins only', () => {
    expect(isOriginAllowed('https://bookworm.vercel.app', allowed)).toBe(true)
    expect(isOriginAllowed('https://bookworm-git-main-me.vercel.app', allowed)).toBe(true)
    expect(isOriginAllowed('https://evil.example.com', allowed)).toBe(false)
    expect(isOriginAllowed('https://bookworm.vercel.app.evil.com', allowed)).toBe(false)
    expect(corsHeaders('https://evil.example.com', allowed)['Access-Control-Allow-Origin']).toBeUndefined()
    expect(corsHeaders('http://localhost:5173', allowed)['Access-Control-Allow-Origin']).toBe('http://localhost:5173')
  })
})
