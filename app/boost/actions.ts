'use server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

// Normalize a TikTok URL for storage and duplicate detection.
//
// IMPORTANT: do NOT lowercase. TikTok video IDs and usernames are
// case-sensitive — lowercasing produces broken links. Just trim
// whitespace and strip a trailing slash. Two URLs that differ only in
// casing are considered DIFFERENT submissions (rare, but the right
// trade-off vs. corrupting the link).
function normalizeTikTokUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, '')
}

interface BoostInput {
  tiktok_url: string
  video_type: 'ACC' | 'TTD'
  boost_requested?: boolean
}

interface BatchInput {
  creator_id: string
  creator_name: string | null
  tiktok_handle: string | null
  notes?: string | null
  videos: BoostInput[]
}

export interface BoostBatchResult {
  inserted?: number
  rowErrors?: { index: number; message: string }[]
  error?: string
}

export async function submitBoost(data: {
  creator_id: string
  creator_name: string | null
  tiktok_handle: string | null
  tiktok_url: string
  boost_reason: string | null
  notes: string | null
  video_type: 'ACC' | 'TTD'
}): Promise<{ error?: string }> {
  // Single-link path delegates to the batch implementation so we keep one
  // dedupe + insert codepath. Returns the same shape callers expect.
  const result = await submitBoostBatch({
    creator_id: data.creator_id,
    creator_name: data.creator_name,
    tiktok_handle: data.tiktok_handle,
    notes: data.notes,
    videos: [{ tiktok_url: data.tiktok_url, video_type: data.video_type }],
  })
  if (result.error) return { error: result.error }
  if (result.rowErrors && result.rowErrors.length > 0) return { error: result.rowErrors[0].message }
  return {}
}

export async function submitBoostBatch(data: BatchInput): Promise<BoostBatchResult> {
  console.log(`[submitBoostBatch] start: creator_id=${data.creator_id}, videos=${data.videos.length}`)
  try {
    if (!data.creator_id) {
      console.log('[submitBoostBatch] missing creator_id — caller did not pass session id')
      return { error: 'No pudimos identificar tu cuenta. Vuelve a iniciar sesión.' }
    }
    if (!data.videos.length) return { error: 'Agrega al menos un video' }

    // First, normalize URLs and validate each row up front.
    const rowErrors: { index: number; message: string }[] = []
    const normalized = data.videos.map((v, i) => {
      const url = normalizeTikTokUrl(v.tiktok_url)
      if (!url) rowErrors.push({ index: i, message: 'Pega el link de tu TikTok' })
      if (v.video_type !== 'ACC' && v.video_type !== 'TTD') rowErrors.push({ index: i, message: 'Selecciona ACC o TTD' })
      return { ...v, tiktok_url: url }
    })

    // In-batch dedupe — same URL submitted twice in this batch.
    const seen = new Map<string, number>()
    normalized.forEach((v, i) => {
      if (!v.tiktok_url) return
      const prev = seen.get(v.tiktok_url)
      if (prev != null) rowErrors.push({ index: i, message: 'Este link aparece más de una vez en tu envío' })
      else seen.set(v.tiktok_url, i)
    })

    if (rowErrors.length > 0) {
      console.log('[submitBoostBatch] validation rowErrors:', rowErrors)
      return { rowErrors }
    }

    // Use the SERVICE-ROLE client for both the dedupe SELECT and the INSERT,
    // so RLS doesn't get in the way — the user is authenticated and submitting
    // a row tied to their own creator_id, and the action is server-side.
    const supabase = createAdminClient()

    // DB dedupe — fetch this creator's existing URLs and reject collisions.
    const { data: existing, error: existingErr } = await supabase
      .from('go_boost_requests')
      .select('tiktok_url')
      .eq('creator_id', data.creator_id)
    if (existingErr) {
      console.log('[submitBoostBatch] dedupe SELECT error:', existingErr.message)
      return { error: `No pudimos verificar tus videos previos: ${existingErr.message}` }
    }
    const existingSet = new Set((existing ?? []).map((r) => normalizeTikTokUrl(r.tiktok_url ?? '')))
    console.log(`[submitBoostBatch] creator has ${existingSet.size} existing rows`)

    normalized.forEach((v, i) => {
      if (existingSet.has(v.tiktok_url)) {
        rowErrors.push({ index: i, message: 'Este video ya fue enviado anteriormente' })
      }
    })
    if (rowErrors.length > 0) {
      console.log('[submitBoostBatch] dedupe rowErrors:', rowErrors)
      return { rowErrors }
    }

    // All rows clean — insert as a batch. Counters do NOT get bumped here;
    // they're bumped on setBoostValidity(true) so only valid videos count.
    const rows = normalized.map((v) => ({
      creator_id: data.creator_id,
      creator_name: data.creator_name,
      tiktok_handle: data.tiktok_handle,
      tiktok_url: v.tiktok_url,
      video_type: v.video_type,
      notes: data.notes ?? null,
      boost_reason: null,
      boost_requested: !!v.boost_requested,
    }))
    console.log(`[submitBoostBatch] inserting ${rows.length} rows:`, rows.map(r => ({ url: r.tiktok_url, type: r.video_type, boost: r.boost_requested })))

    const { error } = await supabase.from('go_boost_requests').insert(rows)
    if (error) {
      console.log(`[submitBoostBatch] INSERT failed code=${error.code} msg=${error.message}`)
      if (error.code === '23505') {
        return { rowErrors: [{ index: 0, message: 'Este video ya fue enviado anteriormente' }] }
      }
      return { error: `No pudimos guardar los videos: ${error.message}` }
    }

    console.log(`[submitBoostBatch] success — inserted ${rows.length} rows`)
    revalidatePath('/boost')
    revalidatePath('/dashboard')
    return { inserted: rows.length }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    console.log('[submitBoostBatch] uncaught error:', msg)
    return { error: `Algo salió mal: ${msg}` }
  }
}

