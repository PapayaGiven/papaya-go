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

export async function sendInvite(creatorId: string): Promise<{ error?: string; email?: string }> {
  const supabase = createAdminClient()

  const { data: creator } = await supabase.from('go_creators').select('email, full_name').eq('id', creatorId).single()
  if (!creator) return { error: 'Creator no encontrado.' }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://papaya-go.vercel.app'

  // Supabase sends the invite email automatically via configured SMTP
  const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
    creator.email,
    {
      data: { full_name: creator.full_name },
      redirectTo: `${siteUrl}/set-password`,
    }
  )
  if (inviteError) return { error: inviteError.message }

  revalidatePath('/admin')
  return { email: creator.email }
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

export async function addCreator(data: {
  email: string
  full_name: string
  tiktok_handle: string
  nivel?: number
}) {
  const supabase = createAdminClient()

  // Only insert into go_creators — no auth user yet
  const { error } = await supabase.from('go_creators').insert({
    email: data.email,
    full_name: data.full_name,
    tiktok_handle: data.tiktok_handle,
    nivel: data.nivel ?? 1,
    status: 'pending',
  })
  if (error) return { error: error.message }
  revalidatePath('/admin')
  return { success: true }
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

export async function updatePOI(
  id: string,
  data: {
    name?: string
    type?: 'hotel' | 'attraction' | 'restaurant'
    city?: string
    state?: string
    commission?: string
    perk?: string
    min_nivel?: number
    capcut_template_url?: string
    image_emoji?: string
  }
) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('go_pois').update(data).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin')
  return { success: true }
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

export async function setAnnouncement(message: string) {
  const supabase = createAdminClient()

  // Deactivate all existing announcements
  await supabase.from('go_announcements').update({ is_active: false }).eq('is_active', true)

  // Insert new active announcement
  const { error } = await supabase.from('go_announcements').insert({
    message,
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
  tiktok_handle: string
  views: string
  video_type: string
}) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('go_viral_videos').insert(data)
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

    const mapVideoType = (raw: string): string => {
      const v = raw.trim().toLowerCase()
      if (v === 'stays' || v === 'acc') return 'ACC'
      if (v === 'experiences' || v === 'ttd') return 'TTD'
      return 'ACC'
    }

    for (const row of rows) {
      if (!row.tiktok_url) continue
      const { error } = await supabase.from('go_viral_videos').upsert(
        {
          tiktok_url: row.tiktok_url,
          tiktok_handle: row.tiktok_handle || null,
          views: row.views || null,
          video_type: mapVideoType(row.video_type || ''),
          is_active: row.is_active ? row.is_active.toLowerCase() !== 'false' : true,
        },
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
