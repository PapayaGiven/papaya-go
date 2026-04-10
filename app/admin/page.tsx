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
  BoostRequest,
  RewardRequest,
} from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const cookieStore = await cookies()
  const session = cookieStore.get('go_admin_session')

  if (session?.value !== 'valid') {
    return <AdminLogin />
  }

  const supabase = createAdminClient()

  const [
    { data: creators },
    { data: pois },
    { data: templates },
    { data: announcements },
    { data: portfolios },
    { data: viralVideos },
    { data: poiRequests },
    { data: nivelRewards },
    { data: boostRequests },
    { data: rewardRequests },
    { data: weeklyPlan },
    { data: challenges },
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
    supabase.from('go_boost_requests').select('*').order('created_at', { ascending: false }),
    supabase.from('go_reward_requests').select('*').order('created_at', { ascending: false }),
    supabase.from('go_weekly_plan').select('*').order('sort_order'),
    supabase.from('go_challenges').select('*').order('created_at', { ascending: false }),
  ])

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
      boostRequests={(boostRequests as BoostRequest[]) ?? []}
      rewardRequests={(rewardRequests as RewardRequest[]) ?? []}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      weeklyPlan={(weeklyPlan ?? []) as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      challenges={(challenges ?? []) as any}
    />
  )
}
