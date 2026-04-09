'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function submitPortfolio(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const mediaKitUrl = (formData.get('media_kit_url') as string)?.trim() || null
  const statsScreenshotUrl =
    (formData.get('stats_screenshot_url') as string)?.trim() || null

  const videoLinks: string[] = []
  for (let i = 0; i < 5; i++) {
    const link = (formData.get(`video_${i}`) as string)?.trim()
    if (link) videoLinks.push(link)
  }

  if (videoLinks.length === 0) {
    return { error: 'Debes agregar al menos un enlace de video de TikTok.' }
  }

  const { error } = await supabase.from('go_portfolio_submissions').insert({
    creator_id: user.id,
    media_kit_url: mediaKitUrl,
    stats_screenshot_url: statsScreenshotUrl,
    video_links: videoLinks,
    status: 'pending',
  })

  if (error) {
    return { error: 'Hubo un error al enviar tu portfolio. Intenta de nuevo.' }
  }

  redirect('/niveles')
}

export async function requestReward(data: {
  creator_id: string
  creator_name: string | null
  tiktok_handle: string | null
  nivel: number
  reward_id: string
  reward_name: string
  notes: string | null
}): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('go_reward_requests').insert(data)
  if (error) return { error: error.message }
  revalidatePath('/niveles')
  return {}
}
