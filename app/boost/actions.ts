'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

// Normalize a TikTok URL for duplicate detection: trim, lowercase, strip
// trailing slashes. Same function is used both before insert and before
// the duplicate check so the comparison is symmetric. Module-private —
// 'use server' files can only export async functions.
function normalizeTikTokUrl(raw: string): string {
  return raw.trim().toLowerCase().replace(/\/+$/, '')
}

interface BoostInput {
  tiktok_url: string
  video_type: 'ACC' | 'TTD'
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

  if (rowErrors.length > 0) return { rowErrors }

  // DB dedupe — fetch this creator's existing URLs and reject collisions.
  const supabase = await createClient()
  const { data: existing, error: existingErr } = await supabase
    .from('go_boost_requests')
    .select('tiktok_url')
    .eq('creator_id', data.creator_id)
  if (existingErr) return { error: existingErr.message }
  const existingSet = new Set((existing ?? []).map((r) => normalizeTikTokUrl(r.tiktok_url)))

  normalized.forEach((v, i) => {
    if (existingSet.has(v.tiktok_url)) {
      rowErrors.push({ index: i, message: 'Este video ya fue enviado anteriormente' })
    }
  })
  if (rowErrors.length > 0) return { rowErrors }

  // All rows clean — insert as a batch. Counters do NOT get bumped here;
  // they're bumped on approveBoostRequest so only approved videos count.
  const rows = normalized.map((v) => ({
    creator_id: data.creator_id,
    creator_name: data.creator_name,
    tiktok_handle: data.tiktok_handle,
    tiktok_url: v.tiktok_url,
    video_type: v.video_type,
    notes: data.notes ?? null,
    boost_reason: null,
  }))
  const { error } = await supabase.from('go_boost_requests').insert(rows)
  if (error) {
    // The UNIQUE constraint catches races where the same URL was inserted
    // between our dedupe and our insert.
    if (error.code === '23505') {
      return { rowErrors: [{ index: 0, message: 'Este video ya fue enviado anteriormente' }] }
    }
    return { error: error.message }
  }

  revalidatePath('/boost')
  revalidatePath('/dashboard')
  return { inserted: rows.length }
}

// Suppress unused-warning for the admin-client import — it's still here so
// reverting to per-submit counter bumps is a one-line change.
void createAdminClient
