// Pure request validation, Google Books access, and normalization for the `books`
// Edge Function. No Deno globals here so the module is unit-testable from Vitest.

export const GOOGLE_BOOKS_BASE = 'https://www.googleapis.com/books/v1/volumes';
export const MAX_RESULTS_LIMIT = 40; // Google Books hard maximum per request
export const DEFAULT_MAX_RESULTS = 20;
export const MAX_START_INDEX = 1000;
export const MAX_QUERY_LENGTH = 100;
export const MAX_BATCH_IDS = 20; // batch lookups fan out to Google; keep the multiplier small
export const MAX_BODY_BYTES = 4096;
export const UPSTREAM_TIMEOUT_MS = 8000;

const VOLUME_ID_PATTERN = /^[A-Za-z0-9_-]{4,40}$/;
const ACTIONS = ['technology', 'search', 'genre', 'volume', 'volumes'] as const;
type Action = (typeof ACTIONS)[number];

// Genres map to Google Books `subject:` searches. `excludeFiction` drops volumes
// whose categories mark them as fiction, so Non-Fiction never shows novels.
export const GENRES: Record<string, { label: string; q: string; excludeFiction?: boolean }> = {
  adventure: { label: 'Adventure', q: 'subject:adventure' },
  technology: { label: 'Technology', q: 'subject:technology' },
  horror: { label: 'Horror', q: 'subject:horror' },
  'sci-fi': { label: 'Sci-Fi', q: 'subject:"science fiction"' },
  fiction: { label: 'Fiction', q: 'subject:fiction' },
  'non-fiction': { label: 'Non-Fiction', q: 'subject:nonfiction', excludeFiction: true },
};

const TECHNOLOGY_QUERY = GENRES.technology.q;

const LIST_FIELDS =
  'totalItems,items(id,volumeInfo(title,subtitle,authors,publisher,publishedDate,description,pageCount,categories,averageRating,imageLinks))';
const VOLUME_FIELDS =
  'id,volumeInfo(title,subtitle,authors,publisher,publishedDate,description,pageCount,categories,averageRating,imageLinks)';

export const NO_DESCRIPTION = 'No description is available for this book yet.';

export class ApiError extends Error {
  status: number;
  code: string;
  retryAfter?: string;
  constructor(status: number, code: string, message: string, retryAfter?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

const badRequest = (message: string) => new ApiError(400, 'INVALID_REQUEST', message);

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
export type BooksRequest =
  | { action: 'technology'; startIndex: number; maxResults: number }
  | { action: 'search'; query: string; startIndex: number; maxResults: number }
  | { action: 'genre'; genre: string; startIndex: number; maxResults: number }
  | { action: 'volume'; id: string }
  | { action: 'volumes'; ids: string[] };

function readInt(value: unknown, name: string, fallback: number, min: number, max: number): number {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw badRequest(`${name} must be an integer.`);
  }
  if (value < min || value > max) {
    throw badRequest(`${name} must be between ${min} and ${max}.`);
  }
  return value;
}

export function isValidVolumeId(id: unknown): id is string {
  return typeof id === 'string' && VOLUME_ID_PATTERN.test(id);
}

export function sanitizeQuery(raw: unknown): string {
  if (typeof raw !== 'string') throw badRequest('query is required.');
  // Quotes and control characters would break out of the intitle:"..." phrase.
  const cleaned = raw.replace(/[\u0000-\u001f\u007f"]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) throw badRequest('query must not be empty.');
  if (cleaned.length > MAX_QUERY_LENGTH) {
    throw badRequest(`query must be at most ${MAX_QUERY_LENGTH} characters.`);
  }
  return cleaned;
}

export function validateRequest(body: unknown): BooksRequest {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw badRequest('Request body must be a JSON object.');
  }
  const input = body as Record<string, unknown>;
  const action = input.action as Action;
  if (!ACTIONS.includes(action)) {
    throw badRequest(`action must be one of: ${ACTIONS.join(', ')}.`);
  }

  const page = () => ({
    startIndex: readInt(input.startIndex, 'startIndex', 0, 0, MAX_START_INDEX),
    maxResults: readInt(input.maxResults, 'maxResults', DEFAULT_MAX_RESULTS, 1, MAX_RESULTS_LIMIT),
  });

  switch (action) {
    case 'technology':
      return { action, ...page() };
    case 'search':
      return { action, query: sanitizeQuery(input.query), ...page() };
    case 'genre': {
      const genre = input.genre;
      if (typeof genre !== 'string' || !Object.hasOwn(GENRES, genre)) {
        throw badRequest(`genre must be one of: ${Object.keys(GENRES).join(', ')}.`);
      }
      return { action, genre, ...page() };
    }
    case 'volume':
      if (!isValidVolumeId(input.id)) throw badRequest('id must be a valid Google Books volume ID.');
      return { action, id: input.id };
    case 'volumes': {
      const ids = input.ids;
      if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_BATCH_IDS) {
        throw badRequest(`ids must be an array of 1 to ${MAX_BATCH_IDS} volume IDs.`);
      }
      if (!ids.every(isValidVolumeId)) throw badRequest('ids contains an invalid volume ID.');
      return { action, ids: [...new Set(ids as string[])] };
    }
  }
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------
export function toHttps(url: unknown): string | null {
  if (typeof url !== 'string' || !url) return null;
  try {
    const parsed = new URL(url.replace(/^http:\/\//i, 'https://'));
    if (parsed.protocol !== 'https:') return null;
    parsed.searchParams.delete('edge'); // drop the page-curl effect
    return parsed.toString();
  } catch {
    return null;
  }
}

// List results only include ~128px thumbnails. Google's image server accepts a
// `fife` size hint for sharper covers; the UI falls back to the thumbnail on error.
export function largerCover(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith('books.google.com') || !parsed.searchParams.has('id')) return url;
    parsed.searchParams.set('fife', 'w480-h720');
    return parsed.toString();
  } catch {
    return url;
  }
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

// Google descriptions contain HTML. Convert to plain text; the UI renders text only.
export function sanitizeDescription(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.trim()) return NO_DESCRIPTION;
  const text = raw
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(p|div|li|h[1-6])\s*>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z0-9]+);/gi, (match, entity: string) => {
      const lower = entity.toLowerCase();
      if (ENTITIES[lower]) return ENTITIES[lower];
      const code = lower.startsWith('#x') ? parseInt(lower.slice(2), 16) : lower.startsWith('#') ? parseInt(lower.slice(1), 10) : NaN;
      return Number.isFinite(code) && code > 31 && code < 0x110000 ? String.fromCodePoint(code) : match;
    })
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!text) return NO_DESCRIPTION;
  return text.length > 6000 ? `${text.slice(0, 5997)}...` : text;
}

const stringList = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v) => typeof v === 'string' && v.trim()).map((v) => v.trim()) : [];

const optionalString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

export interface Book {
  id: string;
  title: string;
  subtitle: string | null;
  authors: string[];
  publisher: string | null;
  publishedDate: string | null;
  pageCount: number | null;
  categories: string[];
  averageRating: number | null;
  description: string;
  hasDescription: boolean;
  thumbnail: string | null;
  cover: string | null;
}

// deno-lint-ignore no-explicit-any
export function normalizeVolume(item: any): Book | null {
  if (!item || !isValidVolumeId(item.id)) return null;
  const info = item.volumeInfo ?? {};
  const links = info.imageLinks ?? {};
  const thumbnail = toHttps(links.thumbnail ?? links.smallThumbnail);
  const large = toHttps(links.extraLarge ?? links.large ?? links.medium ?? links.small);
  const description = sanitizeDescription(info.description);

  return {
    id: item.id,
    title: optionalString(info.title) ?? 'Untitled',
    subtitle: optionalString(info.subtitle),
    authors: stringList(info.authors),
    publisher: optionalString(info.publisher),
    publishedDate: optionalString(info.publishedDate),
    pageCount: Number.isInteger(info.pageCount) && info.pageCount > 0 ? info.pageCount : null,
    categories: stringList(info.categories),
    averageRating: typeof info.averageRating === 'number' ? info.averageRating : null,
    description,
    hasDescription: description !== NO_DESCRIPTION,
    thumbnail,
    cover: large ?? largerCover(thumbnail),
  };
}

export function isFiction(book: Book): boolean {
  return book.categories.some((c) => /fiction/i.test(c) && !/non-?fiction/i.test(c));
}

// ---------------------------------------------------------------------------
// Google Books access
// ---------------------------------------------------------------------------
export interface UpstreamOptions {
  apiKey?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

async function callGoogle(url: URL, opts: UpstreamOptions, notFoundAs404 = false) {
  // Defense in depth: this function only ever talks to the Google Books volumes API.
  if (url.origin !== 'https://www.googleapis.com' || !url.pathname.startsWith('/books/v1/volumes')) {
    throw new ApiError(500, 'INTERNAL_ERROR', 'Refused to call a non-Google Books URL.');
  }
  if (opts.apiKey) url.searchParams.set('key', opts.apiKey);

  const fetchImpl = opts.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(url.toString(), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(opts.timeoutMs ?? UPSTREAM_TIMEOUT_MS),
    });
  } catch (error) {
    const name = (error as Error)?.name;
    if (name === 'TimeoutError' || name === 'AbortError') {
      throw new ApiError(504, 'UPSTREAM_TIMEOUT', 'Google Books took too long to respond. Please try again.');
    }
    throw new ApiError(502, 'UPSTREAM_UNAVAILABLE', 'Could not reach Google Books. Please try again.');
  }

  if (response.status === 429) {
    throw new ApiError(
      429,
      'RATE_LIMITED',
      'Too many book requests right now. Please wait a moment and try again.',
      response.headers.get('retry-after') ?? '30',
    );
  }
  if (notFoundAs404 && (response.status === 404 || response.status === 400 || response.status === 503)) {
    // Google answers unknown volume IDs with 404, 400 or sometimes 503.
    throw new ApiError(404, 'NOT_FOUND', 'That book could not be found.');
  }
  if (response.status === 403) {
    throw new ApiError(503, 'UPSTREAM_UNAVAILABLE', 'The book service is temporarily unavailable.');
  }
  if (!response.ok) {
    throw new ApiError(502, 'UPSTREAM_ERROR', 'Google Books returned an unexpected error.');
  }
  try {
    return await response.json();
  } catch {
    throw new ApiError(502, 'UPSTREAM_ERROR', 'Google Books returned an unreadable response.');
  }
}

export interface BookPage {
  items: Book[];
  totalItems: number;
  startIndex: number;
  nextStartIndex: number;
  hasMore: boolean;
}

export async function fetchList(
  q: string,
  startIndex: number,
  maxResults: number,
  opts: UpstreamOptions,
  { excludeFiction = false, langRestrict = true } = {},
): Promise<BookPage> {
  const url = new URL(GOOGLE_BOOKS_BASE);
  url.searchParams.set('q', q);
  url.searchParams.set('startIndex', String(startIndex));
  url.searchParams.set('maxResults', String(maxResults));
  url.searchParams.set('printType', 'books');
  url.searchParams.set('orderBy', 'relevance');
  if (langRestrict) url.searchParams.set('langRestrict', 'en');
  url.searchParams.set('fields', LIST_FIELDS);

  const data = await callGoogle(url, opts);
  const rawItems: unknown[] = Array.isArray(data?.items) ? data.items : [];
  const totalItems = Number.isInteger(data?.totalItems) ? data.totalItems : 0;

  const seen = new Set<string>();
  const items: Book[] = [];
  for (const raw of rawItems) {
    const book = normalizeVolume(raw);
    if (!book || seen.has(book.id)) continue;
    if (excludeFiction && isFiction(book)) continue;
    seen.add(book.id);
    items.push(book);
  }

  // Pagination advances by what Google returned, not by what survived filtering.
  const nextStartIndex = startIndex + rawItems.length;
  const hasMore = rawItems.length > 0 && nextStartIndex < totalItems && nextStartIndex <= MAX_START_INDEX;
  return { items, totalItems, startIndex, nextStartIndex, hasMore };
}

export async function fetchVolume(id: string, opts: UpstreamOptions): Promise<Book> {
  const url = new URL(`${GOOGLE_BOOKS_BASE}/${encodeURIComponent(id)}`);
  url.searchParams.set('fields', VOLUME_FIELDS);
  const book = normalizeVolume(await callGoogle(url, opts, true));
  if (!book) throw new ApiError(404, 'NOT_FOUND', 'That book could not be found.');
  return book;
}

export async function fetchVolumes(ids: string[], opts: UpstreamOptions) {
  const results = await Promise.allSettled(ids.map((id) => fetchVolume(id, opts)));
  const items: Book[] = [];
  const missing: string[] = [];
  let rateLimited: ApiError | null = null;
  results.forEach((result, i) => {
    if (result.status === 'fulfilled') items.push(result.value);
    else {
      missing.push(ids[i]);
      if (result.reason instanceof ApiError && result.reason.status === 429) rateLimited = result.reason;
    }
  });
  if (items.length === 0 && rateLimited) throw rateLimited;
  return { items, missing };
}

export async function handleBooksRequest(request: BooksRequest, opts: UpstreamOptions) {
  switch (request.action) {
    case 'technology':
      return fetchList(TECHNOLOGY_QUERY, request.startIndex, request.maxResults, opts);
    case 'search':
      return fetchList(`intitle:"${request.query}"`, request.startIndex, request.maxResults, opts, {
        langRestrict: false,
      });
    case 'genre': {
      const genre = GENRES[request.genre];
      return fetchList(genre.q, request.startIndex, request.maxResults, opts, {
        excludeFiction: genre.excludeFiction,
      });
    }
    case 'volume':
      return { book: await fetchVolume(request.id, opts) };
    case 'volumes':
      return fetchVolumes(request.ids, opts);
  }
}

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
export const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173'];

export function parseAllowedOrigins(value: string | undefined): string[] {
  const list = (value ?? '').split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean);
  return list.length ? list : DEFAULT_ALLOWED_ORIGINS;
}

// Entries may contain one `*` wildcard for a subdomain label, e.g. https://bookworm-*.vercel.app
export function isOriginAllowed(origin: string | null, allowed: string[]): boolean {
  if (!origin) return false;
  return allowed.some((entry) => {
    if (!entry.includes('*')) return entry === origin;
    const pattern = entry.split('*').map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[a-z0-9-]+');
    return new RegExp(`^${pattern}$`, 'i').test(origin);
  });
}

export function corsHeaders(origin: string | null, allowed: string[]): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (origin && isOriginAllowed(origin, allowed)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}
