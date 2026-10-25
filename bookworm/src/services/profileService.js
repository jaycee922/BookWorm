import { supabase } from '../lib/supabaseClient'
import { fromSupabaseError } from './errors'

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw fromSupabaseError(error, 'Could not load your profile.')
  return data
}

export async function updateDisplayName(userId, displayName) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ display_name: displayName.trim() })
    .eq('id', userId)
    .select('id, display_name')
    .single()
  if (error) throw fromSupabaseError(error, 'Could not update your display name.')
  return data
}
