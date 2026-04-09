'use server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function submitPOIRequest(data: {
  creator_id: string
  creator_name: string | null
  tiktok_handle: string | null
  place_name: string
  city_state: string
  place_type: string
  reason: string
}): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('go_poi_requests').insert(data)
  if (error) return { error: error.message }
  revalidatePath('/pois')
  return {}
}
