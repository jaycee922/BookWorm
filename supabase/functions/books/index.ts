// BookWorm `books` Edge Function: the only path from the app to Google Books.
// Public (anonymous) read-only proxy. JWT verification is disabled in config.toml
// because guests browse books; every input is validated in lib.ts instead.
import {
  ApiError,
  MAX_BODY_BYTES,
  corsHeaders,
  handleBooksRequest,
  isOriginAllowed,
  parseAllowedOrigins,
  validateRequest,
} from './lib.ts';

const apiKey = Deno.env.get('GOOGLE_BOOKS_API_KEY') ?? undefined;
const allowedOrigins = parseAllowedOrigins(Deno.env.get('ALLOWED_ORIGINS'));

if (!apiKey) console.warn('GOOGLE_BOOKS_API_KEY is not set; requests will use the shared anonymous quota.');

// The batch `volumes` action only serves signed-in users' libraries, so it requires a
// real user session. This limits how much Google quota an anonymous caller can burn.
async function requireUser(req: Request) {
  const authorization = req.headers.get('authorization') ?? '';
  const apikey = req.headers.get('apikey') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!authorization.startsWith('Bearer ') || !supabaseUrl) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Sign in to load your library.');
  }
  let response: Response;
  try {
    response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: authorization, apikey },
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    throw new ApiError(503, 'AUTH_UNAVAILABLE', 'Could not verify your session. Please try again.');
  }
  if (!response.ok) throw new ApiError(401, 'UNAUTHORIZED', 'Sign in to load your library.');
}

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function errorResponse(error: ApiError, headers: Record<string, string>) {
  const extra: Record<string, string> = error.retryAfter ? { 'Retry-After': error.retryAfter } : {};
  return json({ error: { code: error.code, message: error.message } }, error.status, { ...headers, ...extra });
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const headers = corsHeaders(origin, allowedOrigins);

  // Browsers always send Origin on cross-origin calls; reject unknown sites.
  if (origin && !isOriginAllowed(origin, allowedOrigins)) {
    return errorResponse(new ApiError(403, 'FORBIDDEN_ORIGIN', 'This origin is not allowed.'), headers);
  }
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') {
    return errorResponse(new ApiError(405, 'METHOD_NOT_ALLOWED', 'Use POST.'), { ...headers, Allow: 'POST, OPTIONS' });
  }

  try {
    const declaredLength = Number(req.headers.get('content-length') ?? 0);
    if (declaredLength > MAX_BODY_BYTES) {
      throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large.');
    }
    const raw = await req.text();
    if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
      throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large.');
    }
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new ApiError(400, 'INVALID_JSON', 'Request body must be valid JSON.');
    }

    const request = validateRequest(body);
    if (request.action === 'volumes') await requireUser(req);
    const data = await handleBooksRequest(request, { apiKey });
    return json({ data }, 200, headers);
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error, headers);
    console.error('Unhandled books function error', error);
    return errorResponse(new ApiError(500, 'INTERNAL_ERROR', 'Something went wrong.'), headers);
  }
});
