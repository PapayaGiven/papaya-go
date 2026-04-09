'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function saveMediaKitUrl(creatorId: string, url: string): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('go_creators').update({ mediakit_url: url }).eq('id', creatorId)
  if (error) return { error: error.message }
  revalidatePath('/estrategia')
  return {}
}
