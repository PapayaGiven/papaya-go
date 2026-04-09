'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function submitBoost(data: {
  creator_id: string
  creator_name: string | null
  tiktok_handle: string | null
  tiktok_url: string
  boost_reason: string
  notes: string | null
}): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('go_boost_requests').insert(data)
  if (error) return { error: error.message }
  revalidatePath('/boost')
  return {}
}
