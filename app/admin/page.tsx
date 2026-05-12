import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import AdminLogin from '@/components/admin/AdminLogin'
import AdminPanel from '@/components/admin/AdminPanel'
import type {
  Creator,
  POI,
  CapCutTemplate,
  Announcement,
  PortfolioSubmission,
  NivelReward,
  NivelRequirement,
  BoostRequest,
  RewardRequest,
  TikTokAccount,
  InternalVideo,
  MonthlyGoal,
  MonthlySnapshot,
  CreatorSnapshot,
  LevelUpEvent,
  TopPoi,
} from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const cookieStore = await cookies()
  const session = cookieStore.get('go_admin_session')

  if (session?.value !== 'valid') {
    return <AdminLogin />
  }

  const supabase = createAdminClient()

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  const [
    { data: creators },
    { data: pois },
    { data: templates },
    { data: announcements },
    { data: portfolios },
    { data: viralVideos },
    { data: poiRequests },
    { data: nivelRewards },
    { data: nivelRequirements },
    { data: boostRequests },
    { data: rewardRequests },
    { data: challenges },
    { data: tiktokAccounts },
    internalVideosRes,
    { data: monthlyGoal },
    { data: monthlySnapshots },
    { data: creatorSnapshots },
    { data: levelUpEvents },
    { data: topPois },
  ] = await Promise.all([
    supabase
      .from('go_creators')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase
      .from('go_pois')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase
      .from('go_capcut_templates')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase
      .from('go_announcements')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase
      .from('go_portfolio_submissions')
      .select('*, creator:go_creators(full_name, email, nivel)')
      .order('created_at', { ascending: false }),
    supabase
      .from('go_viral_videos')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase
      .from('go_poi_requests')
      .select('*, creator:go_creators(full_name, email)')
      .order('created_at', { ascending: false }),
    supabase.from('go_nivel_rewards').select('*').order('nivel, created_at'),
    supabase.from('go_nivel_requirements').select('*').order('nivel'),
    supabase.from('go_boost_requests').select('*').order('created_at', { ascending: false }),
    supabase.from('go_reward_requests').select('*').order('created_at', { ascending: false }),
    supabase.from('go_challenges').select('*').order('created_at', { ascending: false }),
    supabase.from('go_tiktok_accounts').select('*').order('created_at', { ascending: false }),
    supabase
      .from('go_internal_videos')
      .select('*, creator:go_creators(full_name, email), tiktok_account:go_tiktok_accounts(tiktok_handle, tiktok_url)')
      .order('submitted_at', { ascending: false }),
    supabase
      .from('go_monthly_goals')
      .select('*')
      .eq('month', currentMonth)
      .eq('year', currentYear)
      .maybeSingle(),
    supabase
      .from('go_monthly_snapshots')
      .select('*')
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(24),
    supabase
      .from('go_creator_snapshots')
      .select('*'),
    supabase
      .from('go_level_up_events')
      .select('*')
      .order('leveled_up_at', { ascending: false }),
    supabase
      .from('go_top_pois')
      .select('*')
      .order('rank', { ascending: true }),
  ])

  // Visibility into the internal-videos pipeline. If the count is 0 in
  // production but the table actually has rows, the error/sample lines
  // tell us whether it's RLS, a join issue, or something else.
  const internalVideos = internalVideosRes.data
  console.log('Internal videos fetched:', internalVideos?.length, 'error:', internalVideosRes.error)
  console.log('Sample row:', internalVideos?.[0])

  return (
    <AdminPanel
      creators={(creators as Creator[]) ?? []}
      pois={(pois as POI[]) ?? []}
      templates={(templates as CapCutTemplate[]) ?? []}
      announcements={(announcements as Announcement[]) ?? []}
      portfolios={(portfolios as PortfolioSubmission[]) ?? []}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      viralVideos={(viralVideos ?? []) as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      poiRequests={(poiRequests ?? []) as any}
      nivelRewards={(nivelRewards as NivelReward[]) ?? []}
      nivelRequirements={(nivelRequirements as NivelRequirement[]) ?? []}
      boostRequests={(boostRequests as BoostRequest[]) ?? []}
      rewardRequests={(rewardRequests as RewardRequest[]) ?? []}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      challenges={(challenges ?? []) as any}
      tiktokAccounts={(tiktokAccounts as TikTokAccount[]) ?? []}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      internalVideos={(internalVideos ?? []) as InternalVideo[]}
      monthlyGoal={(monthlyGoal as MonthlyGoal | null) ?? null}
      monthlySnapshots={(monthlySnapshots as MonthlySnapshot[]) ?? []}
      creatorSnapshots={(creatorSnapshots as CreatorSnapshot[]) ?? []}
      levelUpEvents={(levelUpEvents as LevelUpEvent[]) ?? []}
      topPois={(topPois as TopPoi[]) ?? []}
      currentMonth={currentMonth}
      currentYear={currentYear}
    />
  )
}
