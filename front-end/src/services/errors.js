// One error shape for the whole UI: { message, status, code }.
export class AppError extends Error {
  constructor(message, { status = 0, code = 'UNKNOWN', retryAfter = null } = {}) {
    super(message)
    this.name = 'AppError'
    this.status = status
    this.code = code
    this.retryAfter = retryAfter
  }
}

const POSTGRES_MESSAGES = {
  23505: 'That book is already in your library.',
  23503: 'Save this book to your library before writing a reading log.',
  23514: 'Some values were not accepted. Check the form and try again.',
  42501: 'You are not allowed to do that.',
  PGRST116: 'That item could not be found.',
}

// Convert a PostgREST / Auth error from supabase-js into an AppError.
export function fromSupabaseError(error, fallback = 'Something went wrong. Please try again.') {
  if (!error) return new AppError(fallback)
  if (error instanceof AppError) return error
  const message = POSTGRES_MESSAGES[error.code] ?? error.message ?? fallback
  return new AppError(message, { code: error.code ?? 'UNKNOWN', status: error.status ?? 0 })
}

// Convert a supabase.functions.invoke error into an AppError, reading the
// function's JSON body ({ error: { code, message } }) when there is one.
export async function fromFunctionsError(error) {
  const response = error?.context
  if (response && typeof response.status === 'number') {
    let body = null
    try {
      body = await response.clone().json()
    } catch {
      // non-JSON body; fall through to status-based message
    }
    const status = response.status
    const message =
      body?.error?.message ??
      (status === 429 ? 'Too many requests right now. Please wait a moment.' : 'The book service returned an error.')
    return new AppError(message, {
      status,
      code: body?.error?.code ?? 'FUNCTION_ERROR',
      retryAfter: response.headers?.get?.('retry-after') ?? null,
    })
  }
  // No HTTP response: offline, or the browser blocked the call. A blocked CORS preflight
  // usually means this site's origin is missing from the function's ALLOWED_ORIGINS secret.
  console.error(`Book service request failed before a response (origin ${globalThis.location?.origin}).`, error)
  return new AppError('Could not reach the book service. Check your connection and try again.', {
    code: 'NETWORK_ERROR',
  })
}

export function errorMessage(error) {
  return error?.message || 'Something went wrong. Please try again.'
}
