import { supabase } from '../lib/supabaseClient'
import { PAGE_SIZE } from '../lib/constants'
import { AppError, fromFunctionsError } from './errors'

// Every Google Books request goes through the `books` Supabase Edge Function.
// The browser never calls Google directly and never sees the API key.
async function callBooksFunction(payload) {
  if (!supabase) throw new AppError('BookWorm is not configured. Missing Supabase environment variables.')
  const { data, error } = await supabase.functions.invoke('books', { body: payload })
  if (error) throw await fromFunctionsError(error)
  if (!data || typeof data !== 'object' || !data.data) {
    throw new AppError('The book service returned an unexpected response.', { code: 'BAD_RESPONSE' })
  }
  return data.data
}

export function getTechnologyBooks(startIndex = 0, maxResults = PAGE_SIZE) {
  return callBooksFunction({ action: 'technology', startIndex, maxResults })
}

export function searchBooksByTitle(query, startIndex = 0, maxResults = PAGE_SIZE) {
  return callBooksFunction({ action: 'search', query, startIndex, maxResults })
}

export function getGenreBooks(genre, startIndex = 0, maxResults = PAGE_SIZE) {
  return callBooksFunction({ action: 'genre', genre, startIndex, maxResults })
}

export async function getBook(id) {
  const data = await callBooksFunction({ action: 'volume', id })
  return data.book
}

const BATCH_LIMIT = 20 // must match MAX_BATCH_IDS in the Edge Function

// Fetch metadata for a signed-in user's saved books; returns a Map of id -> book.
export async function getBooks(ids) {
  const unique = [...new Set(ids)]
  const books = new Map()
  for (let i = 0; i < unique.length; i += BATCH_LIMIT) {
    const data = await callBooksFunction({ action: 'volumes', ids: unique.slice(i, i + BATCH_LIMIT) })
    for (const book of data.items ?? []) books.set(book.id, book)
  }
  return books
}
