import { supabase } from '../lib/supabaseClient'
import { fromSupabaseError } from './errors'

// All queries rely on RLS: a user can only ever see and change their own rows.
const COLUMNS = 'id, volume_id, reading_status, created_at, updated_at'

export async function listLibrary() {
  const { data, error } = await supabase
    .from('library_items')
    .select(COLUMNS)
    .order('created_at', { ascending: false })
  if (error) throw fromSupabaseError(error, 'Could not load your library.')
  return data
}

export async function getLibraryItem(volumeId) {
  const { data, error } = await supabase
    .from('library_items')
    .select(COLUMNS)
    .eq('volume_id', volumeId)
    .maybeSingle()
  if (error) throw fromSupabaseError(error, 'Could not check your library.')
  return data
}

// user_id is filled by the database default (auth.uid()) and checked by RLS.
export async function addToLibrary(volumeId, readingStatus = 'want_to_read') {
  const { data, error } = await supabase
    .from('library_items')
    .insert({ volume_id: volumeId, reading_status: readingStatus })
    .select(COLUMNS)
    .single()
  if (error) throw fromSupabaseError(error, 'Could not save this book.')
  return data
}

export async function updateReadingStatus(itemId, readingStatus) {
  const { data, error } = await supabase
    .from('library_items')
    .update({ reading_status: readingStatus })
    .eq('id', itemId)
    .select(COLUMNS)
    .single()
  if (error) throw fromSupabaseError(error, 'Could not update the reading status.')
  return data
}

// Deleting a library item cascades to that user's logs for the book (database FK).
export async function removeFromLibrary(itemId) {
  const { error } = await supabase.from('library_items').delete().eq('id', itemId)
  if (error) throw fromSupabaseError(error, 'Could not remove this book.')
}
