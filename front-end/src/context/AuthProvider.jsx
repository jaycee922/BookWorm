import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { AppError, fromSupabaseError } from '../services/errors'
import { getProfile } from '../services/profileService'
import { AuthContext } from './authContext'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(Boolean(supabase))
  const user = session?.user ?? null
  const userId = user?.id ?? null

  useEffect(() => {
    if (!supabase) return undefined
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    // Keep this callback synchronous: awaiting Supabase calls inside it can deadlock.
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null)
      return null
    }
    const next = await getProfile(userId)
    setProfile(next)
    return next
  }, [userId])

  useEffect(() => {
    let active = true
    if (!userId) {
      setProfile(null)
      return undefined
    }
    getProfile(userId)
      .then((next) => active && setProfile(next))
      .catch(() => active && setProfile(null))
    return () => {
      active = false
    }
  }, [userId])

  const signUp = useCallback(async ({ email, password, displayName }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName.trim() },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    })
    if (error) throw fromSupabaseError(error, 'Could not create your account.')
    // With email confirmation enabled Supabase returns no session until the link is clicked.
    return { needsConfirmation: !data.session }
  }, [])

  const signIn = useCallback(async ({ email, password }) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      if (error.code === 'email_not_confirmed') {
        throw new AppError('Please confirm your email address first. Check your inbox for the link.')
      }
      if (error.code === 'invalid_credentials') throw new AppError('Incorrect email or password.')
      throw fromSupabaseError(error, 'Could not log you in.')
    }
  }, [])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw fromSupabaseError(error, 'Could not log you out.')
  }, [])

  const value = useMemo(
    () => ({ session, user, profile, loading, signUp, signIn, signOut, refreshProfile, setProfile }),
    [session, user, profile, loading, signUp, signIn, signOut, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
