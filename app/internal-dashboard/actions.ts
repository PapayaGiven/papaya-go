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

  // Don't let the same link be submitted twice for this creator. Compare
  // against normalized existing URLs so a trailing slash / casing difference
  // can't sneak a duplicate through (the DB UNIQUE constraint is the backstop).
  const { data: existing } = await supabase
    .from('go_internal_videos')
    .select('tiktok_url')
    .eq('creator_id', data.creator_id)
  const isDuplicate = (existing ?? []).some(
    (r) => normalizeTiktokUrl(r.tiktok_url) === normalizedUrl
  )
  if (isDuplicate) {
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
