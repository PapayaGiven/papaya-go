'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { normalizeTiktokUrl } from '@/lib/normalizeUrl'

export async function submitInternalVideo(data: {
  creator_id: string
  tiktok_account_id: string | null
  tiktok_url: string
  video_type: 'ACC' | 'TTD'
}): Promise<{ error?: string; duplicate?: boolean }> {
  const supabase = await createClient()
  const normalizedUrl = normalizeTiktokUrl(data.tiktok_url)
  if (!normalizedUrl) return { error: 'Pega el link de tu video' }

  // Don't let the same link be submitted twice for this creator. Fetch the
  // creator's existing links and compare on the NORMALIZED form — comparing in
  // JS (rather than an .eq filter on the raw column) means legacy rows that were
  // stored before normalization existed still get caught (the DB UNIQUE
  // constraint is the backstop for races).
  console.log('[submitInternalVideo] checking duplicate for:', { creator_id: data.creator_id, url: normalizedUrl })
  const { data: existing, error: checkError } = await supabase
    .from('go_internal_videos')
    .select('id, tiktok_url')
    .eq('creator_id', data.creator_id)
  console.log('[submitInternalVideo] duplicate check result:', {
    checkError,
    rows: (existing ?? []).map((r) => ({ id: r.id, stored: r.tiktok_url, normalized: normalizeTiktokUrl(r.tiktok_url) })),
  })
  const isDuplicate = (existing ?? []).some(
    (r) => normalizeTiktokUrl(r.tiktok_url) === normalizedUrl
  )
  if (isDuplicate) {
    console.log('[submitInternalVideo] DUPLICATE blocked:', normalizedUrl)
    return { error: '⚠️ Este link ya fue enviado anteriormente', duplicate: true }
  }

  const { error } = await supabase.from('go_internal_videos').insert({
    creator_id: data.creator_id,
    tiktok_account_id: data.tiktok_account_id,
    tiktok_url: normalizedUrl,
    video_type: data.video_type,
    status: 'pending',
  })
  if (error) {
    // UNIQUE (creator_id, tiktok_url) violation — race with a concurrent submit.
    if (error.code === '23505') {
      return { error: '⚠️ Este link ya fue enviado anteriormente', duplicate: true }
    }
    return { error: error.message }
  }
  revalidatePath('/internal-dashboard')
  return {}
}
