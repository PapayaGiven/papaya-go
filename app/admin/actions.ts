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

  // Create auth user with invite
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://papaya-go.vercel.app'
  const { data: authData, error: authError } = await supabase.auth.admin.inviteUserByEmail(
    data.email,
    {
      data: { full_name: data.full_name },
      redirectTo: `${siteUrl}/set-password`,
    }
  )
  if (authError) return { error: authError.message }

  // Insert creator row
  const { error } = await supabase.from('go_creators').insert({
    id: authData.user.id,
    email: data.email,
    full_name: data.full_name,
    tiktok_handle: data.tiktok_handle,
    nivel: data.nivel ?? 1,
    gmv_total: 0,
    gmv_this_month: 0,
    acc_this_month: 0,
    ttd_this_month: 0,
    videos_this_month: 0,
    status: 'active',
    approved_at: new Date().toISOString(),
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
  creator_name: string
  views: string
  poi_name: string
  video_type: string
  notes: string
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
  const sheetUrl = process.env.VIRAL_VIDEOS_SHEET_URL
  if (!sheetUrl) return { error: 'VIRAL_VIDEOS_SHEET_URL no está configurada.' }

  try {
    const res = await fetch(sheetUrl)
    if (!res.ok) return { error: `Error fetching sheet: ${res.status}` }
    const text = await res.text()

    const lines = text.split('\n').filter(l => l.trim())
    if (lines.length < 2) return { error: 'La hoja está vacía o no tiene datos.' }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
    const rows = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
      const row: Record<string, string> = {}
      headers.forEach((h, i) => { row[h] = values[i] ?? '' })
      return row
    })

    const supabase = createAdminClient()
    let count = 0

    for (const row of rows) {
      if (!row.tiktok_url) continue
      const { error } = await supabase.from('go_viral_videos').upsert(
        {
          tiktok_url: row.tiktok_url,
          creator_name: row.creator_name || null,
          views: row.views || null,
          poi_name: row.poi_name || null,
          video_type: row.video_type || 'ACC',
          notes: row.notes || null,
          is_active: true,
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
