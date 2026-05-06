'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

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

  // Try to delete auth user if one exists
  const { data: creator } = await supabase.from('go_creators').select('email').eq('id', id).single()
  if (creator?.email) {
    const { data: { users } } = await supabase.auth.admin.listUsers()
    const authUser = users.find((u) => u.email === creator.email)
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
    nivel?: number
    gmv_total?: number
    acc_this_month?: number
    ttd_this_month?: number
    videos_this_month?: number
    status?: 'pending' | 'active' | 'suspended'
  }
) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('go_creators').update(data).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin')
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
  // Check if Supabase auth user exists (returning creator)
  const { data: { users } } = await supabase.auth.admin.listUsers()
  const hasAuth = users.some(u => u.email === email.toLowerCase().trim())
  return { hasAuth }
}

// ── Access Code Auth ─────────────────────────────────

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

  // Check if auth user exists
  const { data: { users } } = await supabase.auth.admin.listUsers()
  const authUser = users.find(u => u.email === email.toLowerCase().trim())

  return { hasAuthAccount: !!authUser }
}

export async function createAuthAndLogin(email: string, password: string): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const emailNorm = email.toLowerCase().trim()

  // Create Supabase auth user
  const { error: createError } = await supabase.auth.admin.createUser({
    email: emailNorm,
    password,
    email_confirm: true,
  })
  if (createError) return { error: createError.message }

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

  // Update or create the auth user
  const { data: { users } } = await supabase.auth.admin.listUsers()
  const authUser = users.find(u => u.email === emailNorm)

  if (authUser) {
    const { error } = await supabase.auth.admin.updateUserById(authUser.id, { password: newPassword })
    if (error) return { error: error.message }
  } else {
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

export async function approveInternalVideo(id: string): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('go_internal_videos')
    .update({ status: 'approved', approved_at: new Date().toISOString(), rejected_at: null, rejection_reason: null })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin')
  revalidatePath('/internal-dashboard')
  return {}
}

export async function bulkApproveInternalVideos(ids: string[]): Promise<{ error?: string; count?: number }> {
  if (ids.length === 0) return { count: 0 }
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('go_internal_videos')
    .update({ status: 'approved', approved_at: new Date().toISOString(), rejected_at: null, rejection_reason: null })
    .in('id', ids)
  if (error) return { error: error.message }
  revalidatePath('/admin')
  revalidatePath('/internal-dashboard')
  return { count: ids.length }
}

export async function rejectInternalVideo(id: string, reason: string): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('go_internal_videos')
    .update({ status: 'rejected', rejected_at: new Date().toISOString(), approved_at: null, rejection_reason: reason })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin')
  revalidatePath('/internal-dashboard')
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
  // Look up the row first so we know whose counters to decrement.
  const { data: row, error: fetchErr } = await supabase
    .from('go_boost_requests')
    .select('creator_id, video_type, created_at')
    .eq('id', id)
    .maybeSingle()
  if (fetchErr) return { error: fetchErr.message }

  const { error: delErr } = await supabase.from('go_boost_requests').delete().eq('id', id)
  if (delErr) return { error: delErr.message }

  // Only decrement counters if the deleted row belongs to the current month.
  // Older rows are no longer reflected in *_this_month fields.
  if (row?.creator_id) {
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

// ── Boost request approve/reject (admin dashboard video tracker) ──

export async function approveBoostRequest(id: string): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('go_boost_requests')
    .update({ status: 'boosteado', rejection_reason: null })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin')
  return {}
}

export async function rejectBoostRequest(id: string, reason: string): Promise<{ error?: string }> {
  const trimmed = reason.trim()
  if (!trimmed) return { error: 'Razón de rechazo requerida' }
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('go_boost_requests')
    .update({ status: 'rejected', rejection_reason: trimmed })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin')
  return {}
}
