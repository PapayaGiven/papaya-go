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
    email: data.email,
    full_name: data.full_name,
    tiktok_handle: data.tiktok_handle,
    nivel: data.nivel ?? 1,
    status: 'active',
    access_code: accessCode,
    approved_at: new Date().toISOString(),
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
  if (creator.status !== 'active') return { error: 'Tu cuenta aún no está activa. Contacta a tu agencia.' }
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
  if (creator.status !== 'active') {
    return { error: 'Tu cuenta aún no está activa. Contacta a tu agencia.' }
  }

  // Check if auth user exists
  const { data: { users } } = await supabase.auth.admin.listUsers()
  const authUser = users.find(u => u.email === email.toLowerCase().trim())

  return { hasAuthAccount: !!authUser }
}

export async function createAuthAndLogin(email: string, password: string): Promise<{ error?: string }> {
  const supabase = createAdminClient()

  // Create auth user
  const { error: createError } = await supabase.auth.admin.createUser({
    email: email.toLowerCase().trim(),
    password,
    email_confirm: true,
  })
  if (createError) return { error: createError.message }

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
  return {}
}

export async function setAnnouncement(message: string, image_url?: string, display_type?: string) {
  const supabase = createAdminClient()

  // Deactivate all existing announcements
  await supabase.from('go_announcements').update({ is_active: false }).eq('is_active', true)

  // Insert new active announcement
  const { error } = await supabase.from('go_announcements').insert({
    message,
    image_url: image_url || null,
    display_type: display_type || 'banner',
    is_active: true,
  })
  if (error) return { error: error.message }
  revalidatePath('/admin')
  return { success: true }
}

export async function toggleAnnouncement(id: string, isActive: boolean) {
  const supabase = createAdminClient()

  // If activating, deactivate all others first
  if (isActive) {
    await supabase.from('go_announcements').update({ is_active: false }).eq('is_active', true)
  }

  const { error } = await supabase
    .from('go_announcements')
    .update({ is_active: isActive })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin')
  return { success: true }
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
