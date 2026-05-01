'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function submitInternalVideo(data: {
  creator_id: string
  tiktok_account_id: string | null
  tiktok_url: string
  video_type: 'ACC' | 'TTD'
}): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('go_internal_videos').insert({
    creator_id: data.creator_id,
    tiktok_account_id: data.tiktok_account_id,
    tiktok_url: data.tiktok_url,
    video_type: data.video_type,
    status: 'pending',
  })
  if (error) return { error: error.message }
  revalidatePath('/internal-dashboard')
  return {}
}
