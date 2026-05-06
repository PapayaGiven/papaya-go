'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function submitBoost(data: {
  creator_id: string
  creator_name: string | null
  tiktok_handle: string | null
  tiktok_url: string
  boost_reason: string | null
  notes: string | null
  video_type: 'ACC' | 'TTD'
}): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('go_boost_requests').insert(data)
  if (error) return { error: error.message }

  // Bump the creator's monthly counters immediately. The boost row is the
  // source of truth, but we keep these denormalized fields in sync so legacy
  // reads (challenges, leaderboard sort) stay consistent. Admin client
  // bypasses RLS so creators can't write to their own row directly.
  const admin = createAdminClient()
  const { data: current } = await admin
    .from('go_creators')
    .select('acc_this_month, ttd_this_month, videos_this_month')
    .eq('id', data.creator_id)
    .maybeSingle()
  if (current) {
    await admin.from('go_creators').update({
      acc_this_month: (current.acc_this_month ?? 0) + (data.video_type === 'ACC' ? 1 : 0),
      ttd_this_month: (current.ttd_this_month ?? 0) + (data.video_type === 'TTD' ? 1 : 0),
      videos_this_month: (current.videos_this_month ?? 0) + 1,
    }).eq('id', data.creator_id)
  }

  revalidatePath('/boost')
  revalidatePath('/dashboard')
  return {}
}
