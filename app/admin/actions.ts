'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import type { BoostStatus } from '@/lib/types'

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'papaya-admin-2024'

// ── Auth ──────────────────────────────────────────────

export async function adminLogin(password: string) {
  if (password !== ADMIN_PASSWORD) {
    return { error: 'Contraseña incorrecta' }
  }
  const cookieStore = await cookies()
  cookieStore.set('go_admin_session', 'valid', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  })
  revalidatePath('/admin')
  return { success: true }
}

export async function adminLogout() {
  const cookieStore = await cookies()
  cookieStore.delete('go_admin_session')
  revalidatePath('/admin')
}

// ── Creators ──────────────────────────────────────────

export async function approveCreator(id: string) {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('go_creators')
    .update({ status: 'active', approved_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin')
  return { success: true }
}

export async function deleteCreator(id: string) {
  const supabase = createAdminClient()

  // Try to delete auth user if one exists. Paginated lookup so creators
  // past listUsers page 1 don't leave orphan auth rows behind.
  const { data: creator } = await supabase.from('go_creators').select('email').eq('id', id).single()
  if (creator?.email) {
    const authUser = await findAuthUserByEmail(supabase, creator.email)
    if (authUser) {
      await supabase.auth.admin.deleteUser(authUser.id)
    }
  }

  const { error } = await supabase.from('go_creators').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin')
  return { success: true }
}

export async function updateCreator(
  id: string,
  data: {
    full_name?: string
    email?: string
    tiktok_handle?: string | null
    nivel?: number
    gmv_total?: number
    gmv_this_month?: number
    acc_this_month?: number
    ttd_this_month?: number
    videos_this_month?: number
    status?: 'pending' | 'active' | 'suspended'
  }
) {
  const supabase = createAdminClient()

  // Normalize the identity-shaped fields before write so the admin's
  // "Editar" modal can't introduce inconsistencies (case-mismatched
  // email, stray @ on handles, whitespace) that would later confuse
  // the Sheets-sync handle matcher or auth lookup.
  const normalized: Record<string, unknown> = { ...data }
  if (typeof data.email === 'string') normalized.email = data.email.trim().toLowerCase()
  if (typeof data.full_name === 'string') normalized.full_name = data.full_name.trim()
  if (typeof data.tiktok_handle === 'string') {
    const cleaned = data.tiktok_handle.replace(/@/g, '').trim()
    normalized.tiktok_handle = cleaned.length === 0 ? null : cleaned
  }

  const { error } = await supabase.from('go_creators').update(normalized).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin')
  // The creator dashboard renders monthly counters from this row, so
  // revalidate it too — without this, a creator on /dashboard would
  // still see the cached pre-edit values until they hit the next
  // dynamic-rendering window.
  revalidatePath('/dashboard')
  return { success: true }
}

/**
 * Creator-facing profile edit — full_name + tiktok_handle only.
 *
 * Two-step authorization:
 *   1. The user-scoped supabase client reads auth.getUser() — the
 *      caller MUST be a signed-in creator. No cookie → no email →
 *      bail with 401-shaped error.
 *   2. The actual update runs through the admin client and is gated
 *      by `eq('email', user.email)`. The email comes from the
 *      authenticated session (server-side), so a creator can never
 *      target someone else's row even if they craft a request. The
 *      admin client is used because RLS UPDATE policies on
 *      go_creators may not allow the authenticated role — and the
 *      gate above makes the bypass safe.
 */
export async function updateOwnProfile(data: {
  full_name?: string
  tiktok_handle?: string | null
}): Promise<{ success?: true; error?: string }> {
  const { createClient } = await import('@/lib/supabase/server')
  const userSupabase = await createClient()
  const { data: { user }, error: authErr } = await userSupabase.auth.getUser()
  if (authErr) return { error: authErr.message }
  if (!user?.email) {
    return { error: 'No autenticada — vuelve a iniciar sesión.' }
  }

  const update: Record<string, unknown> = {}
  if (typeof data.full_name === 'string') {
    update.full_name = data.full_name.trim()
  }
  if (typeof data.tiktok_handle === 'string') {
    const cleaned = data.tiktok_handle.replace(/@/g, '').trim()
    update.tiktok_handle = cleaned.length === 0 ? null : cleaned
  }
  if (Object.keys(update).length === 0) return { success: true }

  // Admin client bypasses RLS; the email constraint above is what
  // keeps the write scoped to the caller's own row.
  const adminSupabase = createAdminClient()
  const { error } = await adminSupabase
    .from('go_creators')
    .update(update)
    .eq('email', user.email)
  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  revalidatePath('/admin')
  return { success: true }
}

/**
 * Inline-edit GMV for a single creator (Admin Dashboard + Creators
 * tab). Scoped to gmv_this_month — kept separate from updateCreator
 * so callers don't need to read the row first, and so the cell can
 * render an obvious-intent action button.
 */
export async function updateCreatorGmv(
  id: string,
  gmv: number,
): Promise<{ error?: string; success?: true }> {
  if (!Number.isFinite(gmv) || gmv < 0) {
    return { error: 'GMV inválido — debe ser un número >= 0.' }
  }
  const supabase = createAdminClient()
  // Keep gmv_total (lifetime cumulative) in sync with the month value.
  // total moves by the DELTA between the old and new month value, so
  // re-editing the same month corrects rather than double-counts. On the
  // first entry of a month oldMonth is 0, so total += gmv as expected.
  const { data: row, error: readErr } = await supabase
    .from('go_creators')
    .select('gmv_this_month, gmv_total')
    .eq('id', id)
    .single()
  if (readErr) return { error: readErr.message }
  const oldMonth = Number(row?.gmv_this_month ?? 0)
  const oldTotal = Number(row?.gmv_total ?? 0)
  const newTotal = Math.max(0, oldTotal - oldMonth + gmv)
  const { error } = await supabase
    .from('go_creators')
    .update({ gmv_this_month: gmv, gmv_total: newTotal })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin')
  // Creator dashboard reads gmv_this_month directly off this row.
  revalidatePath('/dashboard')
  return { success: true }
}

/**
 * Inline-edit the lifetime cumulative GMV (go_creators.gmv_total)
 * directly. Lets admin correct the running total when needed without
 * touching the current-month value. Never auto-resets.
 */
export async function updateCreatorGmvTotal(
  id: string,
  gmv: number,
): Promise<{ error?: string; success?: true }> {
  if (!Number.isFinite(gmv) || gmv < 0) {
    return { error: 'GMV total inválido — debe ser un número >= 0.' }
  }
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('go_creators')
    .update({ gmv_total: gmv })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin')
  revalidatePath('/dashboard')
  return { success: true }
}

function generateAccessCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export async function addCreator(data: {
  email: string
  full_name: string
  tiktok_handle: string
  nivel?: number
}) {
  const supabase = createAdminClient()
  const accessCode = generateAccessCode()

  const { error } = await supabase.from('go_creators').insert({
    email: data.email.toLowerCase().trim(),
    full_name: data.full_name,
    tiktok_handle: data.tiktok_handle,
    nivel: data.nivel ?? 1,
    status: 'pending',
    access_code: accessCode,
  })
  if (error) return { error: error.message }
  revalidatePath('/admin')
  return { success: true, access_code: accessCode }
}

// ── Email Check ─────────────────────────────────────

export async function checkEmail(email: string): Promise<{ error?: string; hasAuth?: boolean }> {
  const supabase = createAdminClient()
  const { data: creator } = await supabase.from('go_creators').select('id, status').eq('email', email.toLowerCase().trim()).single()
  if (!creator) return { error: 'Este email no está registrado. Contacta a tu admin.' }
  if (creator.status === 'suspended') return { error: 'Tu cuenta está suspendida. Contacta a tu agencia.' }
  // Check if Supabase auth user exists (returning creator) — paginated.
  const authUser = await findAuthUserByEmail(supabase, email)
  return { hasAuth: !!authUser }
}

// ── Access Code Auth ─────────────────────────────────

// Supabase's auth.admin.listUsers() defaults to page=1, perPage~50. Calling
// it without pagination silently misses users past the first page — which
// is exactly the bug that caused the forgot-password flow to fall through
// to createUser and report "email already in use". This helper paginates
// until found or exhausted so lookups stay correct as the creator base grows.
async function findAuthUserByEmail(
  supabase: ReturnType<typeof createAdminClient>,
  email: string,
) {
  const target = email.toLowerCase().trim()
  const perPage = 1000
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) {
      console.log(`[findAuthUserByEmail] listUsers page=${page} error:`, error.message)
      return null
    }
    const hit = data.users.find(u => (u.email ?? '').toLowerCase() === target)
    if (hit) return hit
    if (data.users.length < perPage) return null // last page
  }
  return null
}

export async function verifyAccessCode(email: string, code: string): Promise<{ error?: string; hasAuthAccount?: boolean }> {
  const supabase = createAdminClient()

  const { data: creator } = await supabase
    .from('go_creators')
    .select('id, email, access_code, status')
    .eq('email', email.toLowerCase().trim())
    .single()

  if (!creator || creator.access_code !== code.toUpperCase().trim()) {
    return { error: 'Código incorrecto o email no registrado.' }
  }
  if (creator.status === 'suspended') {
    return { error: 'Tu cuenta está suspendida. Contacta a tu agencia.' }
  }

  // Check if auth user exists — paginated lookup, not just first page.
  const authUser = await findAuthUserByEmail(supabase, email)

  return { hasAuthAccount: !!authUser }
}

export async function createAuthAndLogin(email: string, password: string): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const emailNorm = email.toLowerCase().trim()

  // If they already have an auth account (e.g. a partial signup or a
  // returning creator who got routed here by mistake), update their
  // password instead of creating a duplicate — createUser would otherwise
  // throw "email already in use".
  const existing = await findAuthUserByEmail(supabase, emailNorm)
  if (existing) {
    const { error } = await supabase.auth.admin.updateUserById(existing.id, { password })
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase.auth.admin.createUser({
      email: emailNorm,
      password,
      email_confirm: true,
    })
    if (error) return { error: error.message }
  }

  // Activate creator
  await supabase.from('go_creators').update({
    status: 'active',
    approved_at: new Date().toISOString(),
  }).eq('email', emailNorm)

  return {}
}

export async function resetPasswordWithCode(email: string, code: string, newPassword: string): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const emailNorm = email.toLowerCase().trim()

  // Verify email + access code match a creator
  const { data: creator } = await supabase
    .from('go_creators')
    .select('id, email, access_code, status')
    .eq('email', emailNorm)
    .single()

  if (!creator || creator.access_code !== code.toUpperCase().trim()) {
    return { error: 'Email o código incorrecto. Contacta a tu admin.' }
  }
  if (creator.status === 'suspended') {
    return { error: 'Tu cuenta está suspendida. Contacta a tu agencia.' }
  }

  // Update or create the auth user. Lookup is paginated so a creator
  // sitting on listUsers page 2+ no longer falls through to createUser
  // (which would error with "email already in use").
  const authUser = await findAuthUserByEmail(supabase, emailNorm)

  if (authUser) {
    console.log(`[resetPasswordWithCode] updating existing auth user id=${authUser.id} email=${emailNorm}`)
    const { error } = await supabase.auth.admin.updateUserById(authUser.id, { password: newPassword })
    if (error) return { error: error.message }
  } else {
    console.log(`[resetPasswordWithCode] no auth user found, creating fresh for ${emailNorm}`)
    const { error } = await supabase.auth.admin.createUser({
      email: emailNorm,
      password: newPassword,
      email_confirm: true,
    })
    if (error) return { error: error.message }
    await supabase.from('go_creators').update({
      status: 'active',
      approved_at: new Date().toISOString(),
    }).eq('email', emailNorm)
  }

  return {}
}

// ── POIs ──────────────────────────────────────────────

export async function addPOI(data: {
  name: string
  type: 'hotel' | 'attraction' | 'restaurant'
  city: string
  state: string
  commission: string
  perk?: string
  min_nivel: number
  capcut_template_url?: string
  image_emoji?: string
  cta_label?: string
  cta_url?: string
  poi_category?: string
  is_viral_poi?: boolean
  papaya_visited?: boolean
}) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('go_pois').insert({
    ...data,
    is_active: true,
  })
  if (error) return { error: error.message }
  revalidatePath('/admin')
  return { success: true }
}

export async function updatePOI(id: string, data: Partial<{
  name: string; type: string; city: string; state: string; commission: string;
  perk: string; min_nivel: number; capcut_template_url: string; image_emoji: string;
  cta_label: string; cta_url: string; poi_category: string;
  is_viral_poi: boolean; papaya_visited: boolean; times_sold: number;
}>): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('go_pois').update(data).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin')
  revalidatePath('/pois')
  return {}
}

export async function togglePOI(id: string, isActive: boolean) {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('go_pois')
    .update({ is_active: isActive })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin')
  return { success: true }
}

export async function deletePOI(id: string) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('go_pois').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin')
  return { success: true }
}

// ── CapCut Templates ──────────────────────────────────

export async function addTemplate(data: {
  title: string
  description?: string
  url: string
  min_nivel: number
  video_type: 'ACC' | 'TTD' | 'general'
}) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('go_capcut_templates').insert(data)
  if (error) return { error: error.message }
  revalidatePath('/admin')
  return { success: true }
}

export async function deleteTemplate(id: string) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('go_capcut_templates').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin')
  return { success: true }
}

// ── Announcements ─────────────────────────────────────

export async function updateCreatorStrategy(id: string, data: {
  acc_goal?: number
  ttd_goal?: number
  gmv_goal?: number
  special_hashtags?: string | null
  creative_brief?: string | null
  daily_quota?: number
  weekly_quota?: number
  monthly_quota?: number
}): Promise<{ error?: string }> {
  // Normalize hashtags: strip commas, make space-separated
  if (data.special_hashtags) {
    data.special_hashtags = data.special_hashtags.replace(/,/g, ' ').split(/\s+/).filter(Boolean).map(t => t.startsWith('#') ? t : `#${t}`).join(' ')
  }
  const supabase = createAdminClient()
  const { error } = await supabase.from('go_creators').update(data).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin')
  revalidatePath('/dashboard')
  revalidatePath('/internal-dashboard')
  return {}
}

export async function toggleCreatorInternal(id: string, isInternal: boolean): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('go_creators').update({ is_internal: isInternal }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin')
  revalidatePath('/dashboard')
  revalidatePath('/internal-dashboard')
  return {}
}

// ── TikTok Accounts ───────────────────────────────────

export async function addTikTokAccount(data: {
  tiktok_handle: string
  tiktok_url: string | null
  is_active: boolean
  notes: string | null
}): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('go_tiktok_accounts').insert(data)
  if (error) return { error: error.message }
  revalidatePath('/admin')
  revalidatePath('/internal-dashboard')
  return {}
}

export async function updateTikTokAccount(id: string, data: Partial<{
  tiktok_handle: string
  tiktok_url: string | null
  is_active: boolean
  notes: string | null
}>): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('go_tiktok_accounts').update(data).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin')
  revalidatePath('/internal-dashboard')
  return {}
}

export async function deleteTikTokAccount(id: string): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('go_tiktok_accounts').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin')
  revalidatePath('/internal-dashboard')
  return {}
}

// ── Internal Videos ───────────────────────────────────
//
// Internal creators live in their own pipeline (go_internal_videos). For a
// long time the approval flow only flipped status without touching the
// monthly counters on go_creators, so internal videos never counted toward
// the team total or the creator's level-up. Approve/reject/bulk-approve
// now mirror the boost-request flow:
//
//   pending → approved   +1   if submitted_at falls in current month
//   approved → rejected  -1
//   pending → rejected   0
//   approved → approved  0    (idempotent)
//
// Level-up check runs after any increment.

async function approveSingleInternalVideo(
  supabase: ReturnType<typeof createAdminClient>,
  id: string,
): Promise<{ error?: string }> {
  const { data: row, error: readErr } = await supabase
    .from('go_internal_videos')
    .select('creator_id, video_type, status, submitted_at')
    .eq('id', id)
    .maybeSingle()
  if (readErr) return { error: readErr.message }
  if (!row) return { error: 'Video no encontrado' }
  console.log(`[approveInternalVideo] id=${id} before: status=${row.status} type=${row.video_type} submitted_at=${row.submitted_at}`)

  if (row.status === 'approved') return {}

  const { error } = await supabase
    .from('go_internal_videos')
    .update({ status: 'approved', approved_at: new Date().toISOString(), rejected_at: null, rejection_reason: null })
    .eq('id', id)
  if (error) return { error: error.message }

  if (row.creator_id && isThisMonthIso(row.submitted_at)) {
    await adjustCreatorCounters(supabase, row.creator_id, row.video_type as 'ACC' | 'TTD', 1)
    console.log(`[approveInternalVideo] running level-up check for creator=${row.creator_id}`)
    await checkAndApplyLevelUps(row.creator_id)
  } else {
    console.log(`[approveInternalVideo] no counter bump (creator_id=${row.creator_id}, thisMonth=${isThisMonthIso(row.submitted_at)})`)
  }
  return {}
}

export async function approveInternalVideo(id: string): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const r = await approveSingleInternalVideo(supabase, id)
  revalidatePath('/admin')
  revalidatePath('/internal-dashboard')
  revalidatePath('/dashboard')
  return r
}

export async function bulkApproveInternalVideos(ids: string[]): Promise<{ error?: string; count?: number }> {
  if (ids.length === 0) return { count: 0 }
  const supabase = createAdminClient()
  // Iterate so each row's counter bump runs through the same helper. The
  // alternative (single UPDATE … WHERE id IN (…)) would skip counters
  // entirely, which is exactly the bug we're fixing.
  let approved = 0
  for (const id of ids) {
    const r = await approveSingleInternalVideo(supabase, id)
    if (r.error) {
      revalidatePath('/admin')
      revalidatePath('/internal-dashboard')
      revalidatePath('/dashboard')
      return { error: r.error, count: approved }
    }
    approved++
  }
  revalidatePath('/admin')
  revalidatePath('/internal-dashboard')
  revalidatePath('/dashboard')
  return { count: approved }
}

export async function rejectInternalVideo(id: string, reason: string): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { data: row, error: readErr } = await supabase
    .from('go_internal_videos')
    .select('creator_id, video_type, status, submitted_at')
    .eq('id', id)
    .maybeSingle()
  if (readErr) return { error: readErr.message }
  if (!row) return { error: 'Video no encontrado' }
  console.log(`[rejectInternalVideo] id=${id} before: status=${row.status} type=${row.video_type} submitted_at=${row.submitted_at}`)

  if (row.status === 'rejected') return {}
  const wasApproved = row.status === 'approved'

  const { error } = await supabase
    .from('go_internal_videos')
    .update({ status: 'rejected', rejected_at: new Date().toISOString(), approved_at: null, rejection_reason: reason })
    .eq('id', id)
  if (error) return { error: error.message }

  if (wasApproved && row.creator_id && isThisMonthIso(row.submitted_at)) {
    await adjustCreatorCounters(supabase, row.creator_id, row.video_type as 'ACC' | 'TTD', -1)
  } else {
    console.log(`[rejectInternalVideo] no counter reversal (wasApproved=${wasApproved}, thisMonth=${isThisMonthIso(row.submitted_at)})`)
  }

  revalidatePath('/admin')
  revalidatePath('/internal-dashboard')
  revalidatePath('/dashboard')
  return {}
}

function getRanges() {
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dayOfWeek = now.getDay()
  const mondayDiff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const startOfWeek = new Date(startOfDay)
  startOfWeek.setDate(startOfDay.getDate() + mondayDiff)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  return {
    startOfDay: startOfDay.toISOString(),
    startOfWeek: startOfWeek.toISOString(),
    startOfMonth: startOfMonth.toISOString(),
  }
}

export async function getInternalVideoStats(creatorId: string): Promise<{ today: number; week: number; month: number; error?: string }> {
  const supabase = createAdminClient()
  const { startOfDay, startOfWeek, startOfMonth } = getRanges()

  const { data, error } = await supabase
    .from('go_internal_videos')
    .select('approved_at')
    .eq('creator_id', creatorId)
    .eq('status', 'approved')
    .gte('approved_at', startOfMonth)

  if (error) return { today: 0, week: 0, month: 0, error: error.message }

  const today = (data ?? []).filter(v => v.approved_at && v.approved_at >= startOfDay).length
  const week = (data ?? []).filter(v => v.approved_at && v.approved_at >= startOfWeek).length
  const month = (data ?? []).length

  return { today, week, month }
}

export async function setAnnouncement(message: string, image_url?: string, display_type?: string) {
  const supabase = createAdminClient()
  const dtype = display_type || 'banner'

  // Popups: only one active at a time — deactivate other active popups
  if (dtype === 'popup') {
    await supabase.from('go_announcements').update({ is_active: false }).eq('is_active', true).eq('display_type', 'popup')
  }

  const { error } = await supabase.from('go_announcements').insert({
    message,
    image_url: image_url || null,
    image_file_url: image_url || null,
    display_type: dtype,
    is_active: true,
  })
  if (error) return { error: error.message }
  revalidatePath('/admin')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function toggleAnnouncement(id: string, isActive: boolean) {
  const supabase = createAdminClient()

  // If activating a popup, deactivate other active popups first
  if (isActive) {
    const { data: ann } = await supabase.from('go_announcements').select('display_type').eq('id', id).single()
    if (ann?.display_type === 'popup') {
      await supabase.from('go_announcements').update({ is_active: false }).eq('is_active', true).eq('display_type', 'popup')
    }
  }

  const { error } = await supabase.from('go_announcements').update({ is_active: isActive }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin')
  revalidatePath('/dashboard')
  return { success: true }
}

export async function updateAnnouncement(id: string, data: {
  message: string
  image_url?: string | null
  display_type?: string
}): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('go_announcements').update({
    message: data.message,
    image_url: data.image_url ?? null,
    image_file_url: data.image_url ?? null,
    display_type: data.display_type || 'banner',
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin')
  revalidatePath('/dashboard')
  return {}
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const supabase = createAdminClient()
  await supabase.from('go_announcements').delete().eq('id', id)
  revalidatePath('/admin')
  revalidatePath('/dashboard')
}

// ── Portfolio Submissions ─────────────────────────────

export async function updatePortfolioStatus(
  id: string,
  status: 'pending' | 'reviewed' | 'pitched',
  notes?: string
) {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('go_portfolio_submissions')
    .update({ status, notes: notes ?? null })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin')
  return { success: true }
}

// ── Viral Videos ─────────────────────────────────────────

export async function addViralVideo(data: {
  tiktok_url: string
  video_type: string
}) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('go_viral_videos').insert({ tiktok_url: data.tiktok_url.trim(), video_type: data.video_type.toUpperCase() === 'TTD' ? 'TTD' : 'ACC', is_active: true })
  if (error) return { error: error.message }
  revalidatePath('/admin')
  revalidatePath('/viral-videos')
  return { success: true }
}

export async function toggleViralVideo(id: string, isActive: boolean) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('go_viral_videos').update({ is_active: isActive }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin')
  revalidatePath('/viral-videos')
  return { success: true }
}

export async function deleteViralVideo(id: string) {
  const supabase = createAdminClient()
  await supabase.from('go_viral_videos').delete().eq('id', id)
  revalidatePath('/admin')
  revalidatePath('/viral-videos')
}

export async function syncViralVideosFromSheet(): Promise<{ error?: string; count?: number }> {
  const rawUrl = process.env.VIRAL_VIDEOS_SHEET_URL
  const sheetUrl = rawUrl?.replace(/^=+/, '').trim()
  if (!sheetUrl) return { error: 'VIRAL_VIDEOS_SHEET_URL no está configurada.' }

  try {
    console.log('[syncViralVideos] Fetching:', sheetUrl)
    const res = await fetch(sheetUrl, { cache: 'no-store' })
    console.log('[syncViralVideos] Response status:', res.status)
    if (!res.ok) return { error: `Error fetching sheet: ${res.status}` }
    const text = await res.text()

    const lines = text.split('\n').filter(l => l.trim())
    if (lines.length < 2) return { error: 'La hoja está vacía o no tiene datos.' }

    // Parse CSV properly (handle quoted fields with commas)
    const parseCSVLine = (line: string): string[] => {
      const result: string[] = []
      let current = ''
      let inQuotes = false
      for (const ch of line) {
        if (ch === '"') { inQuotes = !inQuotes; continue }
        if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; continue }
        current += ch
      }
      result.push(current.trim())
      return result
    }

    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, '_'))
    const rows = lines.slice(1).map(line => {
      const values = parseCSVLine(line)
      const row: Record<string, string> = {}
      headers.forEach((h, i) => { row[h] = values[i] ?? '' })
      return row
    })

    const supabase = createAdminClient()
    let count = 0

    for (const row of rows) {
      const url = (row.tiktok_url || '').trim()
      if (!url) continue
      const vt = (row.video_type || '').trim().toUpperCase()
      const handle = (row.tiktok_handle || '').trim() || null
      const views = (row.views || '').trim() || null
      const record: Record<string, unknown> = {
        tiktok_url: url,
        video_type: vt === 'TTD' ? 'TTD' : 'ACC',
        is_active: true,
      }
      if (handle) record.tiktok_handle = handle
      if (views) record.views = views
      const { error } = await supabase.from('go_viral_videos').upsert(
        record,
        { onConflict: 'tiktok_url' }
      )
      if (!error) count++
    }

    revalidatePath('/admin')
    revalidatePath('/viral-videos')
    return { count }
  } catch (err) {
    return { error: `Error: ${err instanceof Error ? err.message : 'Unknown'}` }
  }
}

// ── POI Requests ─────────────────────────────────────

export async function updatePOIRequestStatus(id: string, status: string): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('go_poi_requests').update({ status }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin')
  return {}
}

// ── POI times_sold ───────────────────────────────────

export async function updatePOITimesSold(id: string, times_sold: number): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('go_pois').update({ times_sold }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin')
  revalidatePath('/pois')
  return {}
}

// ── Nivel Rewards ────────────────────────────────────

export async function addNivelReward(data: {
  nivel: number
  reward_name: string
  reward_description: string | null
  reward_emoji: string
  cta_label?: string | null
  cta_url?: string | null
  cta_type?: string
  cta_whatsapp_message?: string | null
  form_fields?: unknown | null
}): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('go_nivel_rewards').insert(data)
  if (error) return { error: error.message }
  revalidatePath('/admin')
  return {}
}

export async function updateNivelReward(id: string, data: {
  nivel?: number
  reward_name?: string
  reward_description?: string | null
  reward_emoji?: string
  cta_label?: string | null
  cta_url?: string | null
  cta_type?: string
  cta_whatsapp_message?: string | null
  form_fields?: unknown | null
}): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('go_nivel_rewards').update(data).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin')
  revalidatePath('/niveles')
  return {}
}

export async function toggleNivelReward(id: string, isActive: boolean): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('go_nivel_rewards').update({ is_active: isActive }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin')
  return {}
}

export async function deleteNivelReward(id: string): Promise<void> {
  const supabase = createAdminClient()
  await supabase.from('go_nivel_rewards').delete().eq('id', id)
  revalidatePath('/admin')
}

// ── Nivel Requirements (level commitment) ─────────────
// Edited inline from the admin Rewards tab. checkAndApplyLevelUps reads
// from go_nivel_requirements directly, so changes here take effect on the
// next validation pass without any creator-row migration.

export async function updateNivelRequirement(
  nivel: number,
  data: {
    acc_required?: number
    ttd_required?: number
    total_videos_required?: number
    gmv_required?: number
    perks?: string | null
  },
): Promise<{ error?: string }> {
  if (!Number.isFinite(nivel) || nivel < 1) return { error: 'Nivel inválido' }
  const supabase = createAdminClient()
  const payload: Record<string, unknown> = {}
  if (data.acc_required != null) payload.acc_required = Math.max(0, Math.floor(data.acc_required))
  if (data.ttd_required != null) payload.ttd_required = Math.max(0, Math.floor(data.ttd_required))
  if (data.total_videos_required != null) payload.total_videos_required = Math.max(0, Math.floor(data.total_videos_required))
  if (data.gmv_required != null) payload.gmv_required = Math.max(0, Math.floor(data.gmv_required))
  if (data.perks !== undefined) payload.perks = data.perks
  if (Object.keys(payload).length === 0) return {}
  const { error } = await supabase.from('go_nivel_requirements').update(payload).eq('nivel', nivel)
  if (error) return { error: error.message }
  revalidatePath('/admin')
  revalidatePath('/dashboard')
  return {}
}

// ── Boost Requests ───────────────────────────────────

export async function updateBoostStatus(id: string, status: string): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('go_boost_requests').update({ status }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin')
  return {}
}

export async function deleteBoostRequest(id: string): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  // Look up the row first so we know whether to decrement counters.
  const { data: row, error: fetchErr } = await supabase
    .from('go_boost_requests')
    .select('creator_id, video_type, is_valid, created_at')
    .eq('id', id)
    .maybeSingle()
  if (fetchErr) return { error: fetchErr.message }

  const { error: delErr } = await supabase.from('go_boost_requests').delete().eq('id', id)
  if (delErr) return { error: delErr.message }

  // Only decrement counters when the deleted row was VALID AND belongs to
  // the current month. is_valid=false rows never contributed, and older rows
  // have already been rolled into snapshots.
  if (row?.creator_id && row.is_valid === true) {
    const created = row.created_at ? new Date(row.created_at) : null
    const now = new Date()
    const sameMonth = !!created && created.getUTCFullYear() === now.getUTCFullYear() && created.getUTCMonth() === now.getUTCMonth()
    if (sameMonth) {
      const { data: c } = await supabase
        .from('go_creators')
        .select('acc_this_month, ttd_this_month, videos_this_month')
        .eq('id', row.creator_id)
        .maybeSingle()
      if (c) {
        await supabase.from('go_creators').update({
          acc_this_month: Math.max(0, (c.acc_this_month ?? 0) - (row.video_type === 'ACC' ? 1 : 0)),
          ttd_this_month: Math.max(0, (c.ttd_this_month ?? 0) - (row.video_type === 'TTD' ? 1 : 0)),
          videos_this_month: Math.max(0, (c.videos_this_month ?? 0) - 1),
        }).eq('id', row.creator_id)
      }
    }
  }

  revalidatePath('/admin')
  revalidatePath('/dashboard')
  revalidatePath('/boost')
  return {}
}

// ── Reward Requests ──────────────────────────────────

export async function updateRewardRequestStatus(id: string, status: string): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('go_reward_requests').update({ status }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin')
  return {}
}

// ── Weekly Plan ──────────────────────────────────────

export async function addWeeklyPlan(data: {
  day_name: string
  day_es: string
  video_type: string
  title: string
  description: string | null
  tip: string | null
  sort_order: number
}): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('go_weekly_plan').insert(data)
  if (error) return { error: error.message }
  revalidatePath('/admin')
  revalidatePath('/estrategia')
  return {}
}

export async function updateWeeklyPlan(id: string, data: {
  day_es?: string
  video_type?: string
  title?: string
  description?: string | null
  tip?: string | null
  sort_order?: number
}): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('go_weekly_plan').update(data).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin')
  revalidatePath('/estrategia')
  return {}
}

export async function toggleWeeklyPlan(id: string, isActive: boolean): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('go_weekly_plan').update({ is_active: isActive }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin')
  revalidatePath('/estrategia')
  return {}
}

export async function deleteWeeklyPlan(id: string): Promise<void> {
  const supabase = createAdminClient()
  await supabase.from('go_weekly_plan').delete().eq('id', id)
  revalidatePath('/admin')
  revalidatePath('/estrategia')
}

// ── Challenges ───────────────────────────────────────

export async function addChallenge(data: {
  title: string; description: string | null; challenge_type: string;
  prize: string | null; prize_description: string | null;
  start_date: string; end_date: string
}): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('go_challenges').insert({ ...data, is_active: true })
  if (error) return { error: error.message }
  revalidatePath('/admin')
  revalidatePath('/dashboard')
  return {}
}

export async function toggleChallenge(id: string, isActive: boolean): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('go_challenges').update({ is_active: isActive }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin')
  revalidatePath('/dashboard')
  return {}
}

export async function deleteChallenge(id: string): Promise<void> {
  const supabase = createAdminClient()
  await supabase.from('go_challenges').delete().eq('id', id)
  revalidatePath('/admin')
  revalidatePath('/dashboard')
}

// ── Content Plan ─────────────────────────────────────

function getCurrentWeekMonday(): string {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  return monday.toISOString().split('T')[0]
}

export async function saveContentPlan(
  creatorId: string,
  slots: Array<{ day_of_week: string; video_type: string; place_name: string; hashtags: string }>,
  applyToAll: boolean
): Promise<{ error?: string; count?: number }> {
  const supabase = createAdminClient()
  const weekStart = getCurrentWeekMonday()

  // Delete existing plan for this creator this week
  await supabase.from('go_content_plan').delete().eq('creator_id', creatorId).eq('week_start', weekStart)

  // Insert new slots
  if (slots.length > 0) {
    const rows = slots.map(s => ({
      creator_id: creatorId,
      week_start: weekStart,
      day_of_week: s.day_of_week,
      video_type: s.video_type,
      place_name: s.place_name || null,
      hashtags: s.hashtags || null,
      is_admin_assigned: true,
    }))
    const { error } = await supabase.from('go_content_plan').insert(rows)
    if (error) return { error: error.message }
  }

  let count = 1
  // Apply to all active creators if checked
  if (applyToAll) {
    const { data: creators } = await supabase.from('go_creators').select('id').eq('status', 'active').neq('id', creatorId)
    if (creators) {
      for (const c of creators) {
        await supabase.from('go_content_plan').delete().eq('creator_id', c.id).eq('week_start', weekStart)
        if (slots.length > 0) {
          const rows = slots.map(s => ({
            creator_id: c.id,
            week_start: weekStart,
            day_of_week: s.day_of_week,
            video_type: s.video_type,
            place_name: s.place_name || null,
            hashtags: s.hashtags || null,
            is_admin_assigned: true,
          }))
          await supabase.from('go_content_plan').insert(rows)
        }
        count++
      }
    }
  }

  revalidatePath('/admin')
  revalidatePath('/dashboard')
  return { count }
}

export async function getCreatorPlan(creatorId: string): Promise<Array<{ day_of_week: string; video_type: string; place_name: string | null; hashtags: string | null }>> {
  const supabase = createAdminClient()
  const weekStart = getCurrentWeekMonday()
  const { data } = await supabase.from('go_content_plan').select('day_of_week, video_type, place_name, hashtags').eq('creator_id', creatorId).eq('week_start', weekStart).order('day_of_week')
  return (data ?? []) as Array<{ day_of_week: string; video_type: string; place_name: string | null; hashtags: string | null }>
}

export async function applyGlobalPlan(
  creatorIds: string[],
  slots: Array<{ day_of_week: string; video_type: string; place_name: string; hashtags: string }>
): Promise<{ error?: string; count?: number }> {
  const supabase = createAdminClient()
  const weekStart = getCurrentWeekMonday()

  for (const cid of creatorIds) {
    await supabase.from('go_content_plan').delete().eq('creator_id', cid).eq('week_start', weekStart)
    if (slots.length > 0) {
      const rows = slots.map(s => ({
        creator_id: cid,
        week_start: weekStart,
        day_of_week: s.day_of_week,
        video_type: s.video_type,
        place_name: s.place_name || null,
        hashtags: s.hashtags || null,
        is_admin_assigned: true,
      }))
      await supabase.from('go_content_plan').insert(rows)
    }
  }

  revalidatePath('/admin')
  revalidatePath('/dashboard')
  return { count: creatorIds.length }
}

// ── Monthly snapshots ────────────────────────────────

export async function takeMonthlySnapshot(targetMonth?: number, targetYear?: number): Promise<{ error?: string; month?: number; year?: number; acc?: number; ttd?: number; gmv?: number }> {
  const supabase = createAdminClient()
  const now = new Date()
  // Default: snapshot the PREVIOUS month
  let month = targetMonth ?? now.getMonth() // 0-indexed: getMonth() returns current; -1 for previous
  let year = targetYear ?? now.getFullYear()
  if (targetMonth == null) {
    if (month === 0) { month = 12; year = year - 1 }
    // else month already = previous month (because getMonth is 0-indexed and we want 1-indexed previous)
  }
  // Normalize: month is now 1-indexed
  if (month < 1 || month > 12) return { error: 'Mes inválido' }

  const startIso = new Date(Date.UTC(year, month - 1, 1)).toISOString()
  const endIso = new Date(Date.UTC(year, month, 1)).toISOString()

  // Is the target the current calendar month? GMV (gmv_this_month) is only
  // accurate for the live month; for past months we reuse an existing
  // snapshot's GMV rather than overwriting it with current values.
  const isCurrentMonth = month === (now.getMonth() + 1) && year === now.getFullYear()

  // Team-wide aggregates. ACC/TTD count ONLY is_valid=true boosts, matching
  // lib/videoStats (the live source of truth) so a saved snapshot equals
  // what the dashboard showed live.
  const [boostsRes, creatorsRes, internalRes, existingSnapRes, existingCreatorSnapsRes] = await Promise.all([
    supabase.from('go_boost_requests').select('creator_id, video_type, created_at, is_valid').gte('created_at', startIso).lt('created_at', endIso),
    supabase.from('go_creators').select('id, status, gmv_this_month, nivel, approved_at, is_internal, created_at'),
    supabase.from('go_internal_videos').select('creator_id, video_type, status, submitted_at, approved_at').gte('submitted_at', startIso).lt('submitted_at', endIso),
    supabase.from('go_monthly_snapshots').select('total_gmv').eq('month', month).eq('year', year).maybeSingle(),
    supabase.from('go_creator_snapshots').select('creator_id, gmv').eq('month', month).eq('year', year),
  ])
  if (boostsRes.error) return { error: boostsRes.error.message }
  if (creatorsRes.error) return { error: creatorsRes.error.message }
  if (internalRes.error) return { error: internalRes.error.message }

  const boosts = boostsRes.data ?? []
  const creators = creatorsRes.data ?? []
  const internalRows = internalRes.data ?? []
  const existingSnap = existingSnapRes.data
  const existingGmvByCreator = new Map((existingCreatorSnapsRes.data ?? []).map(r => [r.creator_id, Number(r.gmv ?? 0)]))

  const activeCreators = creators.filter(c => c.status === 'active')
  // Total creators = active AND created on/before the end of the target month.
  const totalCreators = activeCreators.filter(c => c.created_at < endIso).length
  const validBoosts = boosts.filter(b => b.is_valid === true)
  const totalAcc = validBoosts.filter(b => b.video_type === 'ACC').length
  const totalTtd = validBoosts.filter(b => b.video_type === 'TTD').length
  const liveGmv = activeCreators.reduce((s, c) => s + Number(c.gmv_this_month ?? 0), 0)
  const totalGmv = isCurrentMonth ? liveGmv : (existingSnap ? Number(existingSnap.total_gmv ?? 0) : liveGmv)
  const newCreators = creators.filter(c => c.approved_at && c.approved_at >= startIso && c.approved_at < endIso).length
  const intApproved = internalRows.filter(v => v.status === 'approved')
  const intAcc = intApproved.filter(v => v.video_type === 'ACC').length
  const intTtd = intApproved.filter(v => v.video_type === 'TTD').length

  const upsertMonthly = await supabase.from('go_monthly_snapshots').upsert({
    month, year,
    total_acc_videos: totalAcc,
    total_ttd_videos: totalTtd,
    total_gmv: totalGmv,
    total_creators: totalCreators,
    new_creators: newCreators,
    internal_acc_videos: intAcc,
    internal_ttd_videos: intTtd,
    snapshot_taken_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'month,year' })
  if (upsertMonthly.error) return { error: upsertMonthly.error.message }

  // Per-creator snapshots — same is_valid=true rule as the team totals.
  const accByCreator = new Map<string, number>()
  const ttdByCreator = new Map<string, number>()
  for (const b of validBoosts) {
    if (!b.creator_id) continue
    if (b.video_type === 'ACC') accByCreator.set(b.creator_id, (accByCreator.get(b.creator_id) ?? 0) + 1)
    if (b.video_type === 'TTD') ttdByCreator.set(b.creator_id, (ttdByCreator.get(b.creator_id) ?? 0) + 1)
  }
  const rows = activeCreators.map(c => {
    const acc = accByCreator.get(c.id) ?? 0
    const ttd = ttdByCreator.get(c.id) ?? 0
    // GMV: live counter for the current month; for past months reuse the
    // creator's existing snapshot value so we don't overwrite history.
    const gmv = isCurrentMonth
      ? Number(c.gmv_this_month ?? 0)
      : (existingGmvByCreator.has(c.id) ? existingGmvByCreator.get(c.id)! : Number(c.gmv_this_month ?? 0))
    return {
      creator_id: c.id,
      month, year,
      acc_videos: acc,
      ttd_videos: ttd,
      total_videos: acc + ttd,
      gmv,
      nivel: c.nivel,
      snapshot_taken_at: new Date().toISOString(),
    }
  })
  if (rows.length > 0) {
    const upsertCreator = await supabase.from('go_creator_snapshots').upsert(rows, { onConflict: 'creator_id,month,year' })
    if (upsertCreator.error) return { error: upsertCreator.error.message }
  }

  revalidatePath('/admin')
  revalidatePath('/dashboard')
  // acc/ttd returned as combined totals (regular valid + internal approved)
  // to match the Crecimiento card display.
  return { month, year, acc: totalAcc + intAcc, ttd: totalTtd + intTtd, gmv: totalGmv }
}

// ── Monthly goals (admin dashboard) ──────────────────

export async function upsertMonthlyGoal(data: {
  month: number
  year: number
  acc_goal: number
  ttd_goal: number
}): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('go_monthly_goals')
    .upsert(
      {
        month: data.month,
        year: data.year,
        acc_goal: data.acc_goal,
        ttd_goal: data.ttd_goal,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'month,year' },
    )
  if (error) return { error: error.message }
  revalidatePath('/admin')
  return {}
}

// ── Level-up engine ──────────────────────────────────────
//
// Run after any change that bumps a creator's monthly counters. Loops until
// the creator no longer qualifies for the next level (handles batch
// approvals where someone leaps multiple levels at once).
//
// On each level-up:
//   - carry_acc/ttd/total = current counter - CURRENT level's requirement
//     (so the excess past the current threshold rolls into the new level)
//   - gmv_this_month is preserved per spec — GMV doesn't reset on level up
//   - One row inserted into go_level_up_events for the audit trail / popup

interface NivelReqRow {
  nivel: number
  total_videos_required: number
  gmv_required: number
  acc_required: number
  ttd_required: number
}

async function checkAndApplyLevelUps(creatorId: string): Promise<{ events: number }> {
  const supabase = createAdminClient()
  let events = 0

  // Fetch all requirements once; we'll iterate locally.
  const { data: reqsData } = await supabase
    .from('go_nivel_requirements')
    .select('nivel, total_videos_required, gmv_required, acc_required, ttd_required')
  const reqs = (reqsData ?? []) as NivelReqRow[]
  const reqByNivel = new Map(reqs.map(r => [r.nivel, r]))
  console.log(`[level-up] check started for creator=${creatorId}, requirements=`, Array.from(reqByNivel.values()))

  // Loop guard: cap iterations to a sane max so we never spin forever even
  // if requirements data is malformed.
  for (let i = 0; i < 8; i++) {
    const { data: c } = await supabase
      .from('go_creators')
      .select('nivel, acc_this_month, ttd_this_month, videos_this_month, gmv_this_month')
      .eq('id', creatorId)
      .maybeSingle()
    if (!c) { console.log('[level-up] no creator row, exiting'); break }
    console.log(`[level-up] iter ${i}: creator nivel=${c.nivel} acc=${c.acc_this_month} ttd=${c.ttd_this_month} total=${c.videos_this_month} gmv=${c.gmv_this_month}`)

    const next = reqByNivel.get(c.nivel + 1)
    if (!next) { console.log(`[level-up] no requirement for nivel ${c.nivel + 1}, at max`); break }
    console.log(`[level-up] next nivel ${c.nivel + 1} requires:`, next)

    const acc = c.acc_this_month ?? 0
    const ttd = c.ttd_this_month ?? 0
    const total = c.videos_this_month ?? 0
    const gmv = Number(c.gmv_this_month ?? 0)

    const qualifies =
      total >= (next.total_videos_required ?? 0)
      && gmv >= Number(next.gmv_required ?? 0)
      && acc >= (next.acc_required ?? 0)
      && ttd >= (next.ttd_required ?? 0)
    if (!qualifies) {
      console.log(`[level-up] does not qualify yet (total ${total}/${next.total_videos_required}, acc ${acc}/${next.acc_required}, ttd ${ttd}/${next.ttd_required}, gmv ${gmv}/${next.gmv_required})`)
      break
    }

    const cur = reqByNivel.get(c.nivel)
    const carryAcc = Math.max(0, acc - (cur?.acc_required ?? 0))
    const carryTtd = Math.max(0, ttd - (cur?.ttd_required ?? 0))
    const carryTotal = Math.max(0, total - (cur?.total_videos_required ?? 0))
    console.log(`[level-up] LEVELING UP ${c.nivel} -> ${c.nivel + 1}, carry acc=${carryAcc} ttd=${carryTtd} total=${carryTotal}`)

    await supabase.from('go_creators').update({
      nivel: c.nivel + 1,
      acc_this_month: carryAcc,
      ttd_this_month: carryTtd,
      videos_this_month: carryTotal,
      // gmv_this_month intentionally unchanged
    }).eq('id', creatorId)

    await supabase.from('go_level_up_events').insert({
      creator_id: creatorId,
      from_nivel: c.nivel,
      to_nivel: c.nivel + 1,
      carry_acc: carryAcc,
      carry_ttd: carryTtd,
      carry_total: carryTotal,
    })
    events++
  }

  return { events }
}

// ── Boost validation + boost decision (split as of 2026-05) ──
//
// Two orthogonal concepts:
//   is_valid     — admin confirms this is a real TikTok GO video. THIS is
//                  what bumps acc_this_month / ttd_this_month / videos_this_month.
//   boost_status — Papaya's amplification decision. Pending/boosteado/rechazado.
//                  Does NOT touch counters.
//
// Counters only move when is_valid TRANSITIONS, and only for rows in the
// current calendar month (older rows are rolled into snapshots).

function isThisMonthIso(iso: string | null | undefined): boolean {
  if (!iso) return false
  const d = new Date(iso)
  const now = new Date()
  return d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth()
}

async function adjustCreatorCounters(
  supabase: ReturnType<typeof createAdminClient>,
  creatorId: string,
  videoType: 'ACC' | 'TTD' | null,
  delta: 1 | -1,
) {
  const { data: c, error: readErr } = await supabase
    .from('go_creators')
    .select('acc_this_month, ttd_this_month, videos_this_month')
    .eq('id', creatorId)
    .maybeSingle()
  if (readErr) { console.log(`[adjustCreatorCounters] read failed: ${readErr.message}`); return }
  if (!c) { console.log(`[adjustCreatorCounters] no creator row for ${creatorId}`); return }
  const accDelta = videoType === 'ACC' ? delta : 0
  const ttdDelta = videoType === 'TTD' ? delta : 0
  const next = {
    acc_this_month: Math.max(0, (c.acc_this_month ?? 0) + accDelta),
    ttd_this_month: Math.max(0, (c.ttd_this_month ?? 0) + ttdDelta),
    videos_this_month: Math.max(0, (c.videos_this_month ?? 0) + delta),
  }
  console.log(`[adjustCreatorCounters] creator=${creatorId} type=${videoType} delta=${delta}`)
  console.log(`[adjustCreatorCounters] before:`, c)
  console.log(`[adjustCreatorCounters] after:`, next)
  const { error: updErr } = await supabase.from('go_creators').update(next).eq('id', creatorId)
  if (updErr) { console.log(`[adjustCreatorCounters] update failed: ${updErr.message}`); return }
  // Verification read — confirm the write actually landed.
  const { data: verify } = await supabase
    .from('go_creators')
    .select('acc_this_month, ttd_this_month, videos_this_month')
    .eq('id', creatorId)
    .maybeSingle()
  console.log(`[adjustCreatorCounters] verified:`, verify)
}

// ── Validation: counts toward the monthly goal ───────────

export async function setBoostValidity(
  id: string,
  isValid: boolean,
  reason?: string,
): Promise<{ success?: true; error?: string; counters?: { acc_this_month: number; ttd_this_month: number; videos_this_month: number } | null }> {
  console.log(`[setBoostValidity] id=${id} → isValid=${isValid}, reason=${reason ? `"${reason.slice(0, 40)}…"` : '(none)'}`)
  const supabase = createAdminClient()
  const { data: row, error: readErr } = await supabase
    .from('go_boost_requests')
    .select('creator_id, video_type, is_valid, status, created_at')
    .eq('id', id)
    .maybeSingle()
  if (readErr) return { error: readErr.message }
  if (!row) return { error: 'Video no encontrado' }
  console.log(`[setBoostValidity] before: is_valid=${row.is_valid} type=${row.video_type} created_at=${row.created_at}`)

  // is_valid is tri-state (null = unreviewed, true = valid, false = invalid).
  // Only short-circuit when the EXACT same state is already persisted. The
  // common path null → false (admin rejecting a fresh submission) used to be
  // silently treated as a no-op because `(null === true) === false` evaluates
  // to true; that's the bug this guard now avoids.
  if (row.is_valid === isValid) {
    console.log(`[setBoostValidity] no-op: row.is_valid already ${isValid}`)
    return { success: true, counters: null }
  }

  // Keep legacy `status` column in sync only when transitioning INTO valid +
  // not yet boosteado, so old reads still function. Don't override an explicit
  // 'rejected' state if admin re-validates a previously rejected video.
  const updatePayload: Record<string, unknown> = { is_valid: isValid }
  if (isValid && row.status !== 'boosteado') updatePayload.status = 'boosteado'
  // Save rejection_reason so the creator can see why their video was rejected.
  // Cleared when a video is marked valid again.
  if (!isValid && reason && reason.trim()) updatePayload.rejection_reason = reason.trim()
  if (isValid) updatePayload.rejection_reason = null

  const { error } = await supabase
    .from('go_boost_requests')
    .update(updatePayload)
    .eq('id', id)
  if (error) return { error: error.message }

  // Counters track only "currently contributing" rows. Move them only when
  // the contribution state actually flips, derived from prior is_valid:
  //   null → true:  +1   null → false: 0   true → false: -1   false → true: +1
  const wasContributing = row.is_valid === true
  const willContribute = isValid === true
  const counterDelta: 0 | 1 | -1 =
    wasContributing === willContribute ? 0 : (willContribute ? 1 : -1)
  console.log(`[setBoostValidity] counterDelta=${counterDelta} (wasContributing=${wasContributing} willContribute=${willContribute})`)

  let counters: { acc_this_month: number; ttd_this_month: number; videos_this_month: number } | null = null
  if (counterDelta !== 0 && row.creator_id && isThisMonthIso(row.created_at)) {
    await adjustCreatorCounters(
      supabase,
      row.creator_id,
      row.video_type as 'ACC' | 'TTD' | null,
      counterDelta,
    )
    if (counterDelta === 1) {
      console.log(`[setBoostValidity] running level-up check after validating boost ${id}`)
      await checkAndApplyLevelUps(row.creator_id)
    }
    const { data: c } = await supabase
      .from('go_creators')
      .select('acc_this_month, ttd_this_month, videos_this_month')
      .eq('id', row.creator_id)
      .maybeSingle()
    counters = c ?? null
    console.log(`[setBoostValidity] post-update counters:`, counters)
  } else {
    console.log(`[setBoostValidity] counters unchanged (delta=${counterDelta}, this-month=${row.created_at && isThisMonthIso(row.created_at)})`)
  }
  revalidatePath('/admin')
  revalidatePath('/dashboard')
  return { success: true, counters }
}

// Thin wrapper used by the admin "❌ Inválido" modal flow. Accepts an
// optional rejection reason; mirrors setBoostValidity(id, false, reason).
export async function setBoostInvalid(
  boostId: string,
  rejectionReason?: string,
): Promise<{ success?: true; error?: string; counters?: { acc_this_month: number; ttd_this_month: number; videos_this_month: number } | null }> {
  return setBoostValidity(boostId, false, rejectionReason)
}

// ── Boost decision (separate from validity) ──────────────

export async function setBoostStatus(id: string, status: BoostStatus, reason?: string): Promise<{ error?: string }> {
  if (status === 'rechazado' && (!reason || !reason.trim())) {
    return { error: 'Razón de rechazo requerida' }
  }
  const supabase = createAdminClient()
  const updatePayload: Record<string, unknown> = { boost_status: status }
  if (status === 'rechazado') updatePayload.rejection_reason = (reason ?? '').trim()
  if (status === 'boosteado') updatePayload.rejection_reason = null
  const { error } = await supabase
    .from('go_boost_requests')
    .update(updatePayload)
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin')
  revalidatePath('/dashboard')
  return {}
}

// ── Edit video (URL + type) ──────────────────────────────
//
// Lets admin correct a creator's submission. If video_type changes AND the
// row is currently is_valid=true AND in the current month, swap the type's
// counter on go_creators (decrement old, increment new). videos_this_month
// stays the same since the total is unchanged. After the swap, re-run the
// level-up check in case the corrected type pushes the creator over.

export async function updateBoostRequest(
  id: string,
  data: { tiktok_url?: string; video_type?: 'ACC' | 'TTD' },
): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { data: row, error: readErr } = await supabase
    .from('go_boost_requests')
    .select('creator_id, video_type, is_valid, created_at, tiktok_url')
    .eq('id', id)
    .maybeSingle()
  if (readErr) return { error: readErr.message }
  if (!row) return { error: 'Video no encontrado' }

  const updatePayload: Record<string, unknown> = {}
  if (data.tiktok_url != null) {
    const cleaned = data.tiktok_url.trim().toLowerCase().replace(/\/+$/, '')
    if (!cleaned) return { error: 'URL no puede estar vacía' }
    updatePayload.tiktok_url = cleaned
  }
  if (data.video_type && data.video_type !== row.video_type) {
    updatePayload.video_type = data.video_type
  }
  if (Object.keys(updatePayload).length === 0) return {}

  const { error } = await supabase.from('go_boost_requests').update(updatePayload).eq('id', id)
  if (error) {
    if (error.code === '23505') return { error: 'Esa URL ya pertenece a otro video de esta creadora' }
    return { error: error.message }
  }

  // Type swap with counter rebalance. videos_this_month unchanged.
  const typeChanged = updatePayload.video_type != null && row.creator_id && row.is_valid === true && isThisMonthIso(row.created_at)
  if (typeChanged && row.creator_id) {
    const oldType = row.video_type as 'ACC' | 'TTD' | null
    const newType = data.video_type as 'ACC' | 'TTD'
    const { data: c } = await supabase
      .from('go_creators')
      .select('acc_this_month, ttd_this_month')
      .eq('id', row.creator_id)
      .maybeSingle()
    if (c) {
      await supabase.from('go_creators').update({
        acc_this_month: Math.max(0, (c.acc_this_month ?? 0) + (newType === 'ACC' ? 1 : 0) - (oldType === 'ACC' ? 1 : 0)),
        ttd_this_month: Math.max(0, (c.ttd_this_month ?? 0) + (newType === 'TTD' ? 1 : 0) - (oldType === 'TTD' ? 1 : 0)),
      }).eq('id', row.creator_id)
    }
    await checkAndApplyLevelUps(row.creator_id)
  }

  revalidatePath('/admin')
  revalidatePath('/dashboard')
  revalidatePath('/boost')
  return {}
}

// Single-action approval: marks the video valid + boosteado AND increments
// the creator's monthly counters in one go. Used by the "Boostear" approve
// button so admins don't have to click "Válido" separately for counters to
// move. Idempotent: if the row is already is_valid=true, returns without
// touching counters again.
export async function approveBoostRequest(id: string): Promise<{
  success?: true
  error?: string
  message?: string
  newAccCount?: number
  newTtdCount?: number
  newVideosCount?: number
}> {
  try {
    console.log(`[approveBoostRequest] Approving boost: ${id}`)
    console.log(`[approveBoostRequest] Using key type: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'service role' : 'MISSING'}`)
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return { error: 'SUPABASE_SERVICE_ROLE_KEY no está configurada en el servidor' }
    }
    const supabase = createAdminClient()

    // Step 1 — fetch the boost record.
    const { data: boost, error: fetchError } = await supabase
      .from('go_boost_requests')
      .select('*')
      .eq('id', id)
      .single()
    if (fetchError || !boost) {
      console.error('[approveBoostRequest] Failed to fetch boost:', fetchError)
      return { error: 'Video no encontrado' }
    }
    console.log('[approveBoostRequest] fetched:', {
      id, type: boost.video_type, creatorId: boost.creator_id, currentValid: boost.is_valid,
    })

    // Step 2 — idempotency: already approved → don't double-count.
    if (boost.is_valid === true) {
      console.log('[approveBoostRequest] Already approved, skipping')
      // Keep the boost decision coherent even on a re-click.
      if (boost.boost_status !== 'boosteado') {
        await supabase
          .from('go_boost_requests')
          .update({ boost_status: 'boosteado', status: 'boosteado', rejection_reason: null })
          .eq('id', id)
      }
      revalidatePath('/admin')
      revalidatePath('/dashboard')
      revalidatePath('/boost')
      return { success: true, message: 'Already approved' }
    }

    // Step 3 — mark valid + boosteado + clear any rejection reason.
    const { error: updateError } = await supabase
      .from('go_boost_requests')
      .update({ is_valid: true, boost_status: 'boosteado', status: 'boosteado', rejection_reason: null })
      .eq('id', id)
    if (updateError) {
      console.error('[approveBoostRequest] Failed to update is_valid:', updateError)
      return { error: 'Error al aprobar: ' + updateError.message }
    }

    // Step 4 — only count toward this calendar month.
    const isCurrentMonth = isThisMonthIso(boost.created_at)
    console.log('[approveBoostRequest] Is current month:', isCurrentMonth, { boostDate: boost.created_at })

    let newAccCount: number | undefined
    let newTtdCount: number | undefined
    let newVideosCount: number | undefined

    if (isCurrentMonth && boost.creator_id) {
      // Step 5 — increment the creator counter (read current, then write).
      const accDelta = boost.video_type === 'ACC' ? 1 : 0
      const ttdDelta = boost.video_type === 'TTD' ? 1 : 0

      const { data: creator } = await supabase
        .from('go_creators')
        .select('acc_this_month, ttd_this_month, videos_this_month')
        .eq('id', boost.creator_id)
        .single()
      console.log('[approveBoostRequest] Creator before:', creator)

      const next = {
        acc_this_month: (creator?.acc_this_month ?? 0) + accDelta,
        ttd_this_month: (creator?.ttd_this_month ?? 0) + ttdDelta,
        videos_this_month: (creator?.videos_this_month ?? 0) + 1,
      }
      const { error: incrementError } = await supabase
        .from('go_creators')
        .update(next)
        .eq('id', boost.creator_id)
      if (incrementError) {
        // The approval itself worked — surface but don't fail the request.
        console.error('[approveBoostRequest] Failed to increment counter:', incrementError)
      } else {
        const { data: updatedCreator } = await supabase
          .from('go_creators')
          .select('acc_this_month, ttd_this_month, videos_this_month')
          .eq('id', boost.creator_id)
          .single()
        console.log('[approveBoostRequest] Creator after:', updatedCreator)
        newAccCount = updatedCreator?.acc_this_month ?? next.acc_this_month
        newTtdCount = updatedCreator?.ttd_this_month ?? next.ttd_this_month
        newVideosCount = updatedCreator?.videos_this_month ?? next.videos_this_month
      }

      // Step 6 — level-up check after a successful approval+increment.
      console.log(`[approveBoostRequest] running level-up check for ${boost.creator_id}`)
      await checkAndApplyLevelUps(boost.creator_id)
    } else {
      console.log(`[approveBoostRequest] Skipping counter increment (currentMonth=${isCurrentMonth}, creator=${boost.creator_id ?? 'null'})`)
    }

    revalidatePath('/admin')
    revalidatePath('/dashboard')
    revalidatePath('/boost')
    return { success: true, newAccCount, newTtdCount, newVideosCount }
  } catch (e) {
    console.error('[approveBoostRequest] Unexpected error:', e)
    return { error: 'Error inesperado: ' + String(e) }
  }
}

// Approve many boosts in one click. Runs each through approveBoostRequest
// so the counter increment, idempotency guard, and level-up check are
// identical to single approval. Returns how many succeeded.
export async function bulkApproveBoostRequests(
  ids: string[],
): Promise<{ approved: number; failed: number; error?: string }> {
  if (!ids || ids.length === 0) return { approved: 0, failed: 0 }
  let approved = 0
  let failed = 0
  for (const id of ids) {
    const r = await approveBoostRequest(id)
    if (r.error) {
      failed++
      console.log(`[bulkApproveBoostRequests] ${id} failed: ${r.error}`)
    } else {
      approved++
    }
  }
  revalidatePath('/admin')
  revalidatePath('/dashboard')
  revalidatePath('/boost')
  return { approved, failed }
}

export async function rejectBoostRequest(id: string, reason: string): Promise<{ error?: string }> {
  const validityResult = await setBoostValidity(id, false)
  if (validityResult.error) return validityResult
  return setBoostStatus(id, 'rechazado', reason)
}

// Reset a creator's monthly counters (used when admin changes their nivel).
// Per spec: "Cambiar el nivel reiniciará el contador mensual de esta creadora".
// The new nivel's go_nivel_requirements then applies as the goal automatically
// because dashboard reads pull requirements by current nivel.
export async function updateCreatorNivel(id: string, nivel: number): Promise<{ error?: string }> {
  if (nivel < 1 || nivel > 4) return { error: 'Nivel inválido' }
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('go_creators')
    .update({ nivel, acc_this_month: 0, ttd_this_month: 0, videos_this_month: 0 })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin')
  revalidatePath('/dashboard')
  return {}
}

// ── Recompute counters from source data ─────────────────
//
// Rebuilds every active creator's monthly counters from the actual
// validated/approved video rows, so the cached counters on go_creators
// can never silently drift from reality. For the current calendar month:
//
//   acc_this_month = valid ACC boosts + approved ACC internal videos
//   ttd_this_month = valid TTD boosts + approved TTD internal videos
//   videos_this_month = acc_this_month + ttd_this_month
//
// Runs entirely through the admin client so RLS can't block the writes.
export async function recomputeAllCounters(): Promise<{ error?: string; count?: number }> {
  const supabase = createAdminClient()

  // Current calendar month window in UTC, matching isThisMonthIso().
  const now = new Date()
  const startIso = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
  const endIso = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString()
  console.log(`[recomputeAllCounters] window ${startIso} → ${endIso}`)

  // Active creators only. NB: go_creators uses a `status` text column
  // ('active'), there is no `is_active` boolean — querying it 500s with
  // "column go_creators.is_active does not exist".
  const { data: creators, error: creatorsErr } = await supabase
    .from('go_creators')
    .select('id')
    .eq('status', 'active')
  if (creatorsErr) return { error: creatorsErr.message }
  if (!creators || creators.length === 0) return { count: 0 }

  // Valid boost rows for the month.
  const { data: boosts, error: boostErr } = await supabase
    .from('go_boost_requests')
    .select('creator_id, video_type')
    .eq('is_valid', true)
    .gte('created_at', startIso)
    .lt('created_at', endIso)
  if (boostErr) return { error: boostErr.message }

  // Approved internal videos for the month.
  const { data: internals, error: internalErr } = await supabase
    .from('go_internal_videos')
    .select('creator_id, video_type')
    .eq('status', 'approved')
    .gte('submitted_at', startIso)
    .lt('submitted_at', endIso)
  if (internalErr) return { error: internalErr.message }

  // Aggregate ACC/TTD counts per creator from both pipelines.
  const counts = new Map<string, { acc: number; ttd: number }>()
  const bump = (creatorId: string | null, type: string | null) => {
    if (!creatorId) return
    const entry = counts.get(creatorId) ?? { acc: 0, ttd: 0 }
    if (type === 'ACC') entry.acc++
    else if (type === 'TTD') entry.ttd++
    counts.set(creatorId, entry)
  }
  for (const b of boosts ?? []) bump(b.creator_id, b.video_type)
  for (const v of internals ?? []) bump(v.creator_id, v.video_type)

  // Write fresh counters for every active creator (including zeros for
  // creators with no videos this month, so stale values get cleared).
  let updated = 0
  for (const c of creators) {
    const entry = counts.get(c.id) ?? { acc: 0, ttd: 0 }
    const next = {
      acc_this_month: entry.acc,
      ttd_this_month: entry.ttd,
      videos_this_month: entry.acc + entry.ttd,
    }
    const { error: updErr } = await supabase.from('go_creators').update(next).eq('id', c.id)
    if (updErr) {
      console.log(`[recomputeAllCounters] update failed for ${c.id}: ${updErr.message}`)
      continue
    }
    updated++
  }
  console.log(`[recomputeAllCounters] recomputed ${updated}/${creators.length} creators`)

  revalidatePath('/admin')
  revalidatePath('/dashboard')
  return { count: updated }
}

// ── Destructive: reset a calendar month ─────────────────
//
// Backs up that month's go_boost_requests rows, deletes them, zeros every
// active creator's monthly counters, and deletes that month's level-up
// events. Designed to clean up corrupted monthly data while preserving an
// audit trail.

export async function resetCalendarMonth(month: number, year: number, confirmation: string): Promise<{ error?: string; backedUp?: number }> {
  if (confirmation.trim().toUpperCase() !== `RESET ${monthNameUpperEs(month)}`) {
    return { error: `Escribe RESET ${monthNameUpperEs(month)} para confirmar` }
  }
  const supabase = createAdminClient()

  // STEP 1 — backup table (create if missing). Postgres-side: copy structure
  // from go_boost_requests then add a backed_up_at column.
  const createSql = `
    CREATE TABLE IF NOT EXISTS go_boost_requests_backup AS
    SELECT *, now() as backed_up_at FROM go_boost_requests WHERE false;
  `
  const insertSql = `
    INSERT INTO go_boost_requests_backup
    SELECT *, now() FROM go_boost_requests
    WHERE EXTRACT(MONTH FROM created_at) = ${month}
      AND EXTRACT(YEAR FROM created_at) = ${year};
  `
  const deleteRowsSql = `
    DELETE FROM go_boost_requests
    WHERE EXTRACT(MONTH FROM created_at) = ${month}
      AND EXTRACT(YEAR FROM created_at) = ${year};
  `
  const deleteEventsSql = `
    DELETE FROM go_level_up_events
    WHERE EXTRACT(MONTH FROM leveled_up_at) = ${month}
      AND EXTRACT(YEAR FROM leveled_up_at) = ${year};
  `

  // Postgres DDL via Supabase RPC: we use a generic exec_sql RPC if available,
  // else fall back to row-level operations. Most Supabase projects expose
  // pg_net or rpc('execute_sql'); to keep this portable we go through the
  // Postgres-side function. If the project doesn't have it, fall back to
  // row-by-row using the REST API.

  // Step 1 + 2: try the SQL RPC route. If it fails (function missing) fall
  // back to a JS-side backup-then-delete loop.
  const tryRpc = await supabase.rpc('exec_sql' as never, { sql: createSql + insertSql } as never)
  let backedUpCount = 0
  if (tryRpc.error) {
    console.log('[resetCalendarMonth] exec_sql RPC unavailable, falling back to row-level ops:', tryRpc.error.message)
    // Fallback: fetch this month's rows, push into backup table, delete originals.
    const startIso = new Date(Date.UTC(year, month - 1, 1)).toISOString()
    const endIso = new Date(Date.UTC(year, month, 1)).toISOString()
    const { data: rowsToBackup, error: fetchErr } = await supabase
      .from('go_boost_requests')
      .select('*')
      .gte('created_at', startIso)
      .lt('created_at', endIso)
    if (fetchErr) return { error: `Error fetching rows: ${fetchErr.message}` }
    if (rowsToBackup && rowsToBackup.length > 0) {
      // Try inserting into backup. If table doesn't exist, surface a friendly
      // error asking the admin to run the SQL once.
      const backupRows = rowsToBackup.map(r => ({ ...r, backed_up_at: new Date().toISOString() }))
      const { error: backupErr } = await supabase.from('go_boost_requests_backup').insert(backupRows)
      if (backupErr) {
        return { error: `Backup falló — corre primero en Supabase SQL editor:  CREATE TABLE go_boost_requests_backup AS SELECT *, now() as backed_up_at FROM go_boost_requests WHERE false;  Detalle: ${backupErr.message}` }
      }
      backedUpCount = rowsToBackup.length
    }
    const { error: delErr } = await supabase
      .from('go_boost_requests')
      .delete()
      .gte('created_at', startIso)
      .lt('created_at', endIso)
    if (delErr) return { error: `Error deleting boosts: ${delErr.message}` }

    const { error: delEventsErr } = await supabase
      .from('go_level_up_events')
      .delete()
      .gte('leveled_up_at', startIso)
      .lt('leveled_up_at', endIso)
    if (delEventsErr) return { error: `Error deleting level-up events: ${delEventsErr.message}` }
  } else {
    // RPC succeeded; run the deletes via RPC too for atomicity.
    const delRpc = await supabase.rpc('exec_sql' as never, { sql: deleteRowsSql + deleteEventsSql } as never)
    if (delRpc.error) return { error: `Delete RPC falló: ${delRpc.error.message}` }
  }

  // STEP 3 — reset all active creator counters. Service-role bulk update
  // (gmv_this_month and nivel intentionally untouched per spec).
  const { error: resetErr } = await supabase
    .from('go_creators')
    .update({ acc_this_month: 0, ttd_this_month: 0, videos_this_month: 0 })
    .eq('status', 'active')
  if (resetErr) return { error: `Error resetting counters: ${resetErr.message}` }

  revalidatePath('/admin')
  revalidatePath('/dashboard')
  return { backedUp: backedUpCount }
}

function monthNameUpperEs(m: number): string {
  const names = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']
  return names[m - 1] ?? `MES_${m}`
}

// ── Admin: submit videos for a creator (date-aware) ─────
//
// Used by both the per-creator "🎬 Agregar Videos" modal and the bulk
// "📥 Importar Videos de Mayo" modal. Inserts go_boost_requests rows with
// is_valid=true so they count automatically, sets created_at to the date
// the admin picked, and only bumps the creator's *this-month* counters
// when the submission date falls in the current calendar month.

export interface AdminVideoInput {
  tiktok_url: string
  video_type: 'ACC' | 'TTD'
  boost_requested?: boolean
}

export async function adminSubmitVideosForCreator(data: {
  creator_id: string
  date: string // YYYY-MM-DD
  videos: AdminVideoInput[]
}): Promise<{ error?: string; rowErrors?: { index: number; message: string }[]; inserted?: number }> {
  if (!data.videos.length) return { error: 'Agrega al menos un video' }

  const supabase = createAdminClient()
  const { data: creator, error: creatorErr } = await supabase
    .from('go_creators')
    .select('id, full_name, email, tiktok_handle, is_internal')
    .eq('id', data.creator_id)
    .maybeSingle()
  if (creatorErr) return { error: creatorErr.message }
  if (!creator) return { error: 'Creator no encontrada' }

  // Normalize URLs and validate.
  const rowErrors: { index: number; message: string }[] = []
  const normalized = data.videos.map((v, i) => {
    const url = (v.tiktok_url ?? '').trim().toLowerCase().replace(/\/+$/, '')
    if (!url) rowErrors.push({ index: i, message: 'URL requerida' })
    if (v.video_type !== 'ACC' && v.video_type !== 'TTD') rowErrors.push({ index: i, message: 'Selecciona ACC o TTD' })
    return { ...v, tiktok_url: url }
  })

  // In-batch dedupe.
  const seen = new Map<string, number>()
  normalized.forEach((v, i) => {
    if (!v.tiktok_url) return
    if (seen.has(v.tiktok_url)) rowErrors.push({ index: i, message: 'URL duplicada en este envío' })
    else seen.set(v.tiktok_url, i)
  })

  // DB dedupe — check the correct table based on creator type. Internal
  // creators live in go_internal_videos; everyone else in go_boost_requests.
  const dedupeTable = creator.is_internal ? 'go_internal_videos' : 'go_boost_requests'
  const { data: existing } = await supabase
    .from(dedupeTable)
    .select('tiktok_url')
    .eq('creator_id', data.creator_id)
  const existingSet = new Set((existing ?? []).map((r) => (r.tiktok_url ?? '').trim().toLowerCase().replace(/\/+$/, '')))
  normalized.forEach((v, i) => {
    if (existingSet.has(v.tiktok_url)) rowErrors.push({ index: i, message: 'Esta URL ya existe para esta creadora' })
  })

  if (rowErrors.length > 0) return { rowErrors }

  // Insert with the chosen date. Use noon UTC so timezone shifts don't push
  // it into a different day for any reasonable region.
  const createdIso = new Date(`${data.date}T12:00:00Z`).toISOString()
  const dateObj = new Date(createdIso)
  const now = new Date()
  const sameMonth = dateObj.getUTCFullYear() === now.getUTCFullYear() && dateObj.getUTCMonth() === now.getUTCMonth()

  if (creator.is_internal) {
    // Internal pipeline: insert into go_internal_videos as approved so the
    // counter bump fires immediately. submitted_at carries the chosen date.
    const rows = normalized.map((v) => ({
      creator_id: data.creator_id,
      tiktok_account_id: null,
      tiktok_url: v.tiktok_url,
      video_type: v.video_type,
      status: 'approved' as const,
      submitted_at: createdIso,
      approved_at: createdIso,
    }))
    const { error: insErr } = await supabase.from('go_internal_videos').insert(rows)
    if (insErr) {
      if (insErr.code === '23505') return { error: 'Una de las URLs ya existe (constraint UNIQUE)' }
      return { error: insErr.message }
    }

    if (sameMonth) {
      const accAdd = rows.filter(r => r.video_type === 'ACC').length
      const ttdAdd = rows.filter(r => r.video_type === 'TTD').length
      const { data: c } = await supabase
        .from('go_creators')
        .select('acc_this_month, ttd_this_month, videos_this_month')
        .eq('id', data.creator_id)
        .maybeSingle()
      if (c) {
        const before = { ...c }
        const next = {
          acc_this_month: (c.acc_this_month ?? 0) + accAdd,
          ttd_this_month: (c.ttd_this_month ?? 0) + ttdAdd,
          videos_this_month: (c.videos_this_month ?? 0) + rows.length,
        }
        console.log(`[adminSubmitVideosForCreator/internal] creator=${data.creator_id} before=`, before, ' next=', next)
        await supabase.from('go_creators').update(next).eq('id', data.creator_id)
      }
      await checkAndApplyLevelUps(data.creator_id)
    }

    revalidatePath('/admin')
    revalidatePath('/internal-dashboard')
    revalidatePath('/dashboard')
    return { inserted: rows.length }
  }

  // Regular (non-internal) creator: keep the existing boost-request path.
  const rows = normalized.map((v) => ({
    creator_id: data.creator_id,
    creator_name: creator.full_name ?? null,
    tiktok_handle: creator.tiktok_handle ?? null,
    tiktok_url: v.tiktok_url,
    video_type: v.video_type,
    notes: null,
    boost_reason: null,
    boost_requested: !!v.boost_requested,
    is_valid: true, // admin submission: automatically valid
    boost_status: v.boost_requested ? 'pending' : 'pending',
    created_at: createdIso,
  }))

  const { error: insErr } = await supabase.from('go_boost_requests').insert(rows)
  if (insErr) {
    if (insErr.code === '23505') {
      return { error: 'Una de las URLs ya existe (constraint UNIQUE)' }
    }
    return { error: insErr.message }
  }

  if (sameMonth) {
    const accAdd = rows.filter(r => r.video_type === 'ACC').length
    const ttdAdd = rows.filter(r => r.video_type === 'TTD').length
    const { data: c } = await supabase
      .from('go_creators')
      .select('acc_this_month, ttd_this_month, videos_this_month')
      .eq('id', data.creator_id)
      .maybeSingle()
    if (c) {
      await supabase.from('go_creators').update({
        acc_this_month: (c.acc_this_month ?? 0) + accAdd,
        ttd_this_month: (c.ttd_this_month ?? 0) + ttdAdd,
        videos_this_month: (c.videos_this_month ?? 0) + rows.length,
      }).eq('id', data.creator_id)
    }
    await checkAndApplyLevelUps(data.creator_id)
  }

  revalidatePath('/admin')
  revalidatePath('/dashboard')
  revalidatePath('/boost')
  return { inserted: rows.length }
}

// ── Top POIs (Google Sheets sync) ───────────────────────

// Minimal CSV parser that handles quoted fields, escaped quotes ("") and
// commas inside quotes. Spreadsheets export plain CSV but we still see
// occasional quoted entries (e.g. names with commas).
function parseCsvRow(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++ } // escaped quote
        else { inQuotes = false }
      } else {
        cur += ch
      }
    } else {
      if (ch === ',') { out.push(cur); cur = '' }
      else if (ch === '"') { inQuotes = true }
      else { cur += ch }
    }
  }
  out.push(cur)
  return out.map(s => s.trim())
}

function parseCsv(text: string): string[][] {
  // Strip a UTF-8 BOM if present, then split on newlines (handles \r\n + \n).
  const cleaned = text.replace(/^﻿/, '').replace(/\r\n/g, '\n')
  return cleaned.split('\n').filter(l => l.trim().length > 0).map(parseCsvRow)
}

export async function syncTopPois(
  poiType: 'ACC' | 'TTD',
): Promise<{ error?: string; count?: number; removedDuplicates?: number; duplicateIds?: string[] }> {
  const rawUrl = poiType === 'ACC' ? process.env.TOP_ACC_SHEET_URL : process.env.TOP_TTD_SHEET_URL
  if (!rawUrl) return { error: `${poiType === 'ACC' ? 'TOP_ACC_SHEET_URL' : 'TOP_TTD_SHEET_URL'} no está configurado en Vercel` }

  // Sanitize: strip any leading "=" sign (sometimes copy-pasted from spreadsheet
  // formulas) and trim whitespace.
  const url = rawUrl.replace(/^=+/, '').trim()

  let csv: string
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return { error: `No se pudo leer el Google Sheet (${res.status})` }
    csv = await res.text()
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error al leer el Google Sheet' }
  }

  const rows = parseCsv(csv)
  if (rows.length < 2) return { error: 'El Google Sheet está vacío o no tiene encabezado' }

  // Header detection — find columns by name (case-insensitive). Falls back to
  // positional [Nombre, County, POI ID] if the header doesn't match expectations.
  const header = rows[0].map(h => h.toLowerCase())
  const nameIdx = (() => {
    const i = header.findIndex(h => h.includes('nombre') || h === 'name')
    return i >= 0 ? i : 0
  })()
  const countyIdx = (() => {
    const i = header.findIndex(h => h.includes('county') || h.includes('condado'))
    return i >= 0 ? i : 1
  })()
  const poiIdIdx = (() => {
    const i = header.findIndex(h => h.includes('poi id') || h === 'id' || h === 'poi_id')
    return i >= 0 ? i : 2
  })()

  const supabase = createAdminClient()
  const dataRows = rows.slice(1)
  const now = new Date().toISOString()

  // Pass 1: shape rows, drop the truly empty ones. Empty poi_id stays as NULL
  // — Postgres treats NULL as distinct in UNIQUE(poi_id, poi_type) so multiple
  // un-IDed rows coexist fine after we re-insert.
  type SyncRow = {
    name: string
    county: string | null
    poi_id: string | null
    poi_type: 'ACC' | 'TTD'
    rank: number
    is_active: true
    synced_at: string
  }
  const shaped: SyncRow[] = []
  let missingIdCount = 0
  for (let i = 0; i < dataRows.length; i++) {
    const cells = dataRows[i]
    const name = (cells[nameIdx] ?? '').trim()
    const county = (cells[countyIdx] ?? '').trim() || null
    const poi_id = (cells[poiIdIdx] ?? '').trim() || null
    if (!name) continue
    if (!poi_id) missingIdCount++
    shaped.push({ name, county, poi_id, poi_type: poiType, rank: shaped.length + 1, is_active: true, synced_at: now })
  }
  if (missingIdCount > 0) console.log(`[syncTopPois] ${poiType}: ${missingIdCount} fila(s) sin POI ID (se conservan con poi_id=NULL)`)
  if (shaped.length === 0) return { error: 'No se encontraron filas válidas en el Sheet' }

  // Pass 2: first-occurrence-wins dedupe by poi_id. NULL poi_ids are not
  // deduped against each other (different unnamed rows shouldn't collide).
  const seen = new Map<string, SyncRow>()
  const duplicateIds: string[] = []
  const final: SyncRow[] = []
  for (const row of shaped) {
    if (row.poi_id == null) { final.push(row); continue }
    if (seen.has(row.poi_id)) {
      duplicateIds.push(row.poi_id)
      continue
    }
    seen.set(row.poi_id, row)
    final.push(row)
  }
  const removed = duplicateIds.length
  console.log(`Removed ${removed} duplicate POI IDs from sheet`)
  if (removed > 0) {
    console.log(`[syncTopPois] ${poiType} duplicate poi_ids dropped (first-occurrence kept):`, duplicateIds)
  }

  // Re-rank after dedupe so ranks stay 1..N contiguous.
  final.forEach((r, i) => { r.rank = i + 1 })

  // Delete-then-insert per poi_type. Sidesteps the ON CONFLICT DO UPDATE
  // race that fires when the sheet has dupes — every sync is a full
  // replacement of that type's rows. Other types are untouched.
  const { error: delErr } = await supabase.from('go_top_pois').delete().eq('poi_type', poiType)
  if (delErr) return { error: `Error al limpiar lugares previos: ${delErr.message}` }

  const { error: insErr } = await supabase.from('go_top_pois').insert(final)
  if (insErr) {
    if (insErr.code === '23505') {
      return {
        error: `El sheet tiene IDs duplicados que ya están en la base. Revisa las filas: ${duplicateIds.slice(0, 10).join(', ')}`,
        duplicateIds,
      }
    }
    return { error: `Error al insertar lugares: ${insErr.message}`, duplicateIds }
  }

  revalidatePath('/admin')
  revalidatePath('/inspiracion')
  return { count: final.length, removedDuplicates: removed, duplicateIds: removed > 0 ? duplicateIds : undefined }
}

export async function updateTopPoi(id: string, data: Partial<{ name: string; county: string | null; poi_id: string | null; rank: number | null; is_active: boolean }>): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('go_top_pois').update(data).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin')
  revalidatePath('/inspiracion')
  return {}
}

export async function deleteTopPoi(id: string): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('go_top_pois').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin')
  revalidatePath('/inspiracion')
  return {}
}

// ── Settings (key/value store on go_settings) ───────────────

export async function getSetting(key: string): Promise<{ value?: string | null; error?: string }> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('go_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle()
  if (error) return { error: error.message }
  return { value: data?.value ?? null }
}

export async function setSetting(key: string, value: string): Promise<{ error?: string; success?: true }> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('go_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) return { error: error.message }
  revalidatePath('/admin')
  return { success: true }
}

// ── Weekly report CSV download ──────────────────────────────

/**
 * Build the weekly CSV the admin downloads via the 📥 button. Google
 * Sheets sync moved to /api/sheets/sync (uses googleapis + the
 * hard-coded master sheet ID); this action only ever returns CSV
 * now, so the admin always has a manual backup channel even if the
 * service account is misconfigured.
 */
export async function exportWeeklyReport(): Promise<{
  csv?: string
  filename?: string
  error?: string
}> {
  const { computeWeeklyReport, formatReportAsCsv } = await import('@/lib/weekly-report')
  const supabase = createAdminClient()
  try {
    const report = await computeWeeklyReport(supabase)
    const csv = formatReportAsCsv(report)
    const filename = `papaya-go-reporte-${report.weekStartIso.slice(0, 10)}.csv`
    return { csv, filename }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error desconocido'
    return { error: msg }
  }
}
