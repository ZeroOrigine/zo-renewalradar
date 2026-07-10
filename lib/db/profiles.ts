// CANONICAL: RenewalRadar profile service — the ONLY module that queries
// renewalradar_profiles. Routes and pages call these functions; they never
// touch the table directly (service-oriented architecture).

import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { Profile } from '@/lib/db/types'

// Explicit columns — never select('*').
export const PROFILE_COLUMNS =
  'id, email, full_name, avatar_url, role, default_currency, timezone, default_alert_days, onboarding_completed, created_at, updated_at'

export async function getProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('renewalradar_profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    throw error
  }
  return (data as Profile | null) ?? null
}

/**
 * Profiles are normally created by the signup trigger. If that trigger ever
 * raced or failed, we self-heal here instead of showing the user an error.
 */
export async function ensureProfile(
  supabase: SupabaseClient,
  user: User
): Promise<Profile | null> {
  const existing = await getProfile(supabase, user.id)
  if (existing) {
    return existing
  }

  const { error: insertError } = await supabase.from('renewalradar_profiles').insert({
    id: user.id,
    email: user.email ?? null,
    full_name:
      (user.user_metadata?.full_name as string | undefined) ??
      (user.user_metadata?.name as string | undefined) ??
      null,
    avatar_url: (user.user_metadata?.avatar_url as string | undefined) ?? null,
  })

  // 23505 = unique violation: another request inserted concurrently. Fine.
  if (insertError && insertError.code !== '23505') {
    throw insertError
  }

  return getProfile(supabase, user.id)
}

// Only the columns the authenticated role is GRANTed to update (see schema
// section 7). Never add id, email, or role here — Postgres would reject it.
export interface ProfileUpdateInput {
  full_name?: string | null
  avatar_url?: string | null
  default_currency?: string
  timezone?: string
  default_alert_days?: number[]
  onboarding_completed?: boolean
}

export async function updateProfile(
  supabase: SupabaseClient,
  userId: string,
  patch: ProfileUpdateInput
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('renewalradar_profiles')
    .update(patch)
    .eq('id', userId)
    .select(PROFILE_COLUMNS)
    .maybeSingle()

  if (error) {
    throw error
  }
  return (data as Profile | null) ?? null
}
