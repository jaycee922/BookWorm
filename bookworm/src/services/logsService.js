import { supabase } from '../lib/supabaseClient'
import { fromSupabaseError } from './errors'

// Only the author's display name is embedded; profiles hold no email addresses.
const COLUMNS = 'id, user_id, volume_id, body, rating, created_at, updated_at, author:profiles(display_name)'

export async function listLogsForBook(volumeId) {
  const { data, error } = await supabase
    .from('logs')
    .select(COLUMNS)
    .eq('volume_id', volumeId)
    .order('created_at', { ascending: false })
  if (error) throw fromSupabaseError(error, 'Could not load reader logs.')
  return data
}

export async function listMyLogs(userId) {
  const { data, error } = await supabase
    .from('logs')
    .select(COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw fromSupabaseError(error, 'Could not load your logs.')
  return data
}

// user_id comes from auth.uid(); the composite FK requires the book to be in the
// author's own library, so the database rejects logs for unsaved books.
export async function createLog({ volumeId, body, rating }) {
  const { data, error } = await supabase
    .from('logs')
    .insert({ volume_id: volumeId, body: body.trim(), rating: rating ?? null })
    .select(COLUMNS)
    .single()
  if (error) throw fromSupabaseError(error, 'Could not save your log.')
  return data
}

export async function updateLog(logId, { body, rating }) {
  const { data, error } = await supabase
    .from('logs')
    .update({ body: body.trim(), rating: rating ?? null })
    .eq('id', logId)
    .select(COLUMNS)
    .single()
  if (error) throw fromSupabaseError(error, 'Could not update your log.')
  return data
}

export async function deleteLog(logId) {
  const { error } = await supabase.from('logs').delete().eq('id', logId)
  if (error) throw fromSupabaseError(error, 'Could not delete your log.')
}
