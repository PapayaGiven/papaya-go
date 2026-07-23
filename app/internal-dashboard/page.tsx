import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Creator, TikTokAccount, InternalVideo } from '@/lib/types'
import InternalDashboardClient from './InternalDashboardClient'

export const dynamic = 'force-dynamic'

export default async function InternalDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: creator } = await supabase
    .from('go_creators')
    .select('*')
    .eq('email', user.email!)
    .single<Creator>()

  if (!creator) redirect('/')
  if (!creator.is_internal) redirect('/dashboard')
  if (creator.status === 'pending') redirect('/pending')

  const admin = createAdminClient()

  // Date ranges
  const now = new Date()
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dayOfWeek = now.getDay()
  const mondayDiff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const startOfWeek = new Date(startOfDay)
  startOfWeek.setDate(startOfDay.getDate() + mondayDiff)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const [accountsRes, videosRes] = await Promise.all([
    admin.from('go_tiktok_accounts').select('*').eq('is_active', true).order('tiktok_handle'),
    admin
      .from('go_internal_videos')
      .select('*, tiktok_account:go_tiktok_accounts(tiktok_handle, tiktok_url)')
      .eq('creator_id', creator.id)
      .order('submitted_at', { ascending: false }),
  ])

  const accounts = (accountsRes.data ?? []) as TikTokAccount[]
  const videos = (videosRes.data ?? []) as InternalVideo[]

  // Quota progress is counted by submitted_at — the creator-facing meaning
  // of "she did 3 videos today" is anchored to when she posted, not when
  // admin happened to approve. status='approved' still gates inclusion so
  // pending/rejected rows never count.
  const approved = videos.filter(v => v.status === 'approved')

  // Split each window into ACC / TTD / total so the dashboard can show the
  // breakdown as separate badges instead of a single count.
  const split = (list: InternalVideo[]) => {
    let acc = 0
    let ttd = 0
    for (const v of list) {
      if (v.video_type === 'ACC') acc++
      else if (v.video_type === 'TTD') ttd++
    }
    return { acc, ttd, total: acc + ttd }
  }

  const today = split(approved.filter(v => new Date(v.submitted_at) >= startOfDay))
  const week = split(approved.filter(v => new Date(v.submitted_at) >= startOfWeek))
  const month = split(approved.filter(v => new Date(v.submitted_at) >= startOfMonth))

  return (
    <InternalDashboardClient
      creator={creator}
      accounts={accounts}
      videos={videos}
      stats={{ today, week, month }}
    />
  )
}
