import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Sidebar from '@/components/Sidebar'
import AnnouncementPopup from '@/components/AnnouncementPopup'
import DashboardClient from './DashboardClient'
import DashboardHashtags from './DashboardHashtags'
import ProgressRings from './ProgressRings'
import MisVideosCard from './MisVideosCard'
import LevelUpPopup from './LevelUpPopup'
import RefreshButton from './RefreshButton'
import type { LevelUpEvent } from '@/lib/types'
import { Creator, NivelRequirement, Announcement, Challenge, NIVEL_NAMES, NIVEL_COLORS } from '@/lib/types'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: creator } = await supabase.from('go_creators').select('*').eq('email', user.email!).single<Creator>()
  if (!creator) redirect('/')
  if (creator.status === 'pending') redirect('/pending')

  const admin = createAdminClient()
  // Calculate current week Monday
  const nowDate = new Date()
  const dayOfWeek = nowDate.getDay()
  const mondayDiff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(nowDate)
  monday.setDate(nowDate.getDate() + mondayDiff)
  const weekStart = monday.toISOString().split('T')[0]
  const dayNames = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
  const todayName = dayNames[nowDate.getDay()]

  // Source-of-truth video counts: count this-month boost requests.
  const startOfMonth = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1).toISOString()
  // Last day of current month at 23:59:59 — explicit upper bound so a row
  // saved with a future created_at (timezone skew, manual import) doesn't
  // leak into the month total.
  const endOfMonth = new Date(nowDate.getFullYear(), nowDate.getMonth() + 1, 0, 23, 59, 59).toISOString()
  const prevDate = new Date(nowDate.getFullYear(), nowDate.getMonth() - 1, 1)
  const prevMonth = prevDate.getMonth() + 1
  const prevYear = prevDate.getFullYear()

  const [announcementRes, currentNivelRes, challengeRes, leaderboardRes, todayPlanRes, myBoostsRes, lastSnapshotRes, levelUpsRes, nivelRewardsRes] = await Promise.all([
    admin.from('go_announcements').select('*').eq('is_active', true).order('created_at', { ascending: false }),
    admin.from('go_nivel_requirements').select('*').eq('nivel', creator.nivel).maybeSingle(),
    admin.from('go_challenges').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    admin.from('go_creators').select('id, full_name, nivel, videos_this_month, gmv_this_month, acc_this_month, ttd_this_month').eq('status', 'active').order('videos_this_month', { ascending: false }).limit(10),
    admin.from('go_content_plan').select('*').eq('creator_id', creator.id).eq('week_start', weekStart).eq('day_of_week', todayName).limit(1).maybeSingle(),
    admin.from('go_boost_requests').select('id, tiktok_url, video_type, status, is_valid, boost_status, rejection_reason, created_at').eq('creator_id', creator.id).gte('created_at', startOfMonth).lte('created_at', endOfMonth).order('created_at', { ascending: false }),
    admin.from('go_creator_snapshots').select('acc_videos, ttd_videos, gmv').eq('creator_id', creator.id).eq('month', prevMonth).eq('year', prevYear).maybeSingle(),
    admin
      .from('go_level_up_events')
      .select('*')
      .eq('creator_id', creator.id)
      .gte('leveled_up_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('leveled_up_at', { ascending: false }),
    admin.from('go_nivel_rewards').select('nivel, reward_name').eq('is_active', true),
  ])

  const recentLevelUps = (levelUpsRes.data ?? []) as LevelUpEvent[]
  const rewardsByNivel: Record<number, string[]> = {}
  for (const r of (nivelRewardsRes.data ?? []) as { nivel: number; reward_name: string }[]) {
    if (!rewardsByNivel[r.nivel]) rewardsByNivel[r.nivel] = []
    rewardsByNivel[r.nivel].push(r.reward_name)
  }

  type MyBoost = { id: string; tiktok_url: string; video_type: 'ACC' | 'TTD' | null; status: string; is_valid: boolean | null; boost_status: 'pending' | 'boosteado' | 'rechazado'; rejection_reason: string | null; created_at: string }
  const myBoostsThisMonth = (myBoostsRes.data ?? []) as MyBoost[]
  const submittedAcc = myBoostsThisMonth.filter(b => b.video_type === 'ACC').length
  const submittedTtd = myBoostsThisMonth.filter(b => b.video_type === 'TTD').length
  // is_valid=true counts toward the goal; the "submitted" totals show alongside.
  const liveAccThisMonth = myBoostsThisMonth.filter(b => b.video_type === 'ACC' && b.is_valid === true).length
  const liveTtdThisMonth = myBoostsThisMonth.filter(b => b.video_type === 'TTD' && b.is_valid === true).length
  const liveVideosThisMonth = liveAccThisMonth + liveTtdThisMonth
  const submittedVideosThisMonth = submittedAcc + submittedTtd
  // "Pending review" = not yet validated (regardless of boost decision).
  const pendingThisMonth = myBoostsThisMonth.filter(b => b.is_valid == null).length

  const todayPlan = todayPlanRes.data as { video_type: string; place_name: string | null; hashtags: string | null } | null
  const allAnnouncements = (announcementRes.data ?? []) as Announcement[]
  const banners = allAnnouncements.filter(a => a.display_type !== 'popup')
  const popup = allAnnouncements.find(a => a.display_type === 'popup') ?? null
  const currentNivelReq = currentNivelRes.data as NivelRequirement | null
  const challenge = challengeRes.data as Challenge | null
  const allCreators = (leaderboardRes.data ?? []) as Pick<Creator, 'id' | 'full_name' | 'nivel' | 'videos_this_month' | 'gmv_this_month' | 'acc_this_month' | 'ttd_this_month'>[]

  // Challenge leaderboard
  let challengeLeaderboard: { name: string; nivel: number; score: number }[] = []
  if (challenge) {
    const fieldMap: Record<string, keyof Pick<Creator, 'videos_this_month' | 'gmv_this_month' | 'acc_this_month' | 'ttd_this_month'>> = {
      most_videos: 'videos_this_month', highest_gmv: 'gmv_this_month', most_acc: 'acc_this_month', most_ttd: 'ttd_this_month',
    }
    const field = fieldMap[challenge.challenge_type] ?? 'videos_this_month'
    challengeLeaderboard = allCreators
      .map(c => ({ name: c.full_name?.split(' ')[0] ?? 'Creator', nivel: c.nivel, score: Number(c[field] ?? 0) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
  }

  const firstName = creator.full_name?.split(' ')[0] ?? 'Creadora'
  const nivelColor = NIVEL_COLORS[creator.nivel] ?? NIVEL_COLORS[1]
  // Current nivel requirements (drives the monthly goal rings)
  const videosRequired = currentNivelReq?.total_videos_required ?? 12
  const gmvRequired = currentNivelReq?.gmv_required ?? 0

  let challengeDaysLeft = 0
  if (challenge) {
    challengeDaysLeft = Math.max(Math.ceil((new Date(challenge.end_date).getTime() - Date.now()) / 86400000), 0)
  }

  // Month name in Spanish + days remaining in month
  const SPANISH_MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  const monthName = SPANISH_MONTHS[nowDate.getMonth()]
  const lastDay = new Date(nowDate.getFullYear(), nowDate.getMonth() + 1, 0).getDate()
  const daysRemainingInMonth = Math.max(lastDay - nowDate.getDate(), 0)

  return (
    <div className="min-h-screen bg-[#fff8f2]">
      <LevelUpPopup events={recentLevelUps} rewardsByNivel={rewardsByNivel} />
      <Sidebar creatorName={creator.full_name} tiktokHandle={creator.tiktok_handle} nivel={creator.nivel} />

      {/* Banners — multiple can be active, stacked */}
      {banners.map(b => {
        const imgUrl = b.image_url || b.image_file_url
        return (
          <div key={b.id} className="md:ml-[220px] bg-go-orange text-white font-dm text-sm">
            {imgUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imgUrl} alt="" className="w-full max-h-48 object-cover" style={{ borderRadius: '0 0 12px 12px' }} />
            )}
            <div className="px-4 py-3 max-w-5xl mx-auto">📢 {b.message}</div>
          </div>
        )
      })}
      {/* Popup — only one */}
      {popup && <AnnouncementPopup announcement={popup} />}

      <main className="md:ml-[220px] pb-20 md:pb-0">
        <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">

          {/* HERO */}
          <div className="rounded-2xl overflow-hidden relative" style={{ background: 'linear-gradient(135deg, #fff8f2 0%, #ffe8d0 100%)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://mmhsulgcowhqimypglul.supabase.co/storage/v1/object/public/PGLOGOS/PapayaGo-Sun-Orange-39.png" alt="" className="absolute right-4 top-1/2 -translate-y-1/2 w-32 md:w-44 h-32 md:h-44 opacity-[0.15] pointer-events-none select-none" aria-hidden="true" />
            <div className="p-6 md:p-8 relative z-10">
              <h1 className="font-syne font-bold text-2xl md:text-3xl text-[#1a0800]">¡Hola, {firstName}! 🧡</h1>
              <p className="font-dm text-sm text-[#1a0800]/60 mt-2 max-w-md">
                {creator.nivel === 1 && 'Estás comenzando tu journey. ¡Cada video te acerca más! 🌱'}
                {creator.nivel === 2 && '¡Vas increíble! Sigue posteando y los deals llegarán. 🔥'}
                {creator.nivel === 3 && 'Eres Partner de Papaya GO. ¡El mundo te está viendo! ⭐'}
                {creator.nivel >= 4 && 'Elite. La mejor de las mejores. Tú inspiras a todas. 👑'}
              </p>
              <div className="flex items-center gap-3 mt-4 flex-wrap">
                <span className={`font-dm text-xs font-bold px-3 py-1 rounded-full ${nivelColor.bg} ${nivelColor.text}`}>Nivel {creator.nivel} · {NIVEL_NAMES[creator.nivel]}</span>
                <span className="font-dm text-xs text-[#1a0800]/50">{liveVideosThisMonth} aprobados / {submittedVideosThisMonth} enviados este mes</span>
                <RefreshButton />
              </div>
            </div>
          </div>

          {/* CARD 1: Tu tarea de hoy */}
          {(() => {
            // Use today's plan hashtags if available, else creator's special_hashtags, else default
            const rawHashtags = todayPlan?.hashtags || creator.special_hashtags || '#tiktokgostay'
            const tags = rawHashtags.replace(/,/g, ' ').split(/\s+/).filter(Boolean).map(t => t.startsWith('#') ? t : `#${t}`)
            const taskVideoType = todayPlan?.video_type ?? 'ACC'
            const taskPlace = todayPlan?.place_name
            return (
              <div className="bg-white border-2 border-[#ff7700]/30 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">🎯</span>
                  <h2 className="font-syne font-bold text-lg text-[#1a0800]">Tu tarea de hoy</h2>
                </div>
                {todayPlan ? (
                  <p className="font-dm text-sm text-gray-500 mb-4">
                    {taskPlace ? `Graba un video ${taskVideoType} en ${taskPlace}.` : `Graba un video ${taskVideoType} hoy.`}
                  </p>
                ) : (
                  <p className="font-dm text-sm text-gray-500 mb-4">
                    {creator.nivel <= 2 ? 'Postea 1 video ACC de un hotel hoy. Usa el tag verde.' : 'Postea 1 video ACC o TTD hoy. Revisa tus Papaya Visits para inspiración.'}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 mb-3">
                  <span className={`font-dm text-xs font-semibold px-3 py-1 rounded-full ${taskVideoType === 'TTD' ? 'bg-purple-100 text-purple-700' : taskVideoType === 'general' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>{taskVideoType}</span>
                  {taskPlace && <span className="font-dm text-xs font-semibold px-3 py-1 rounded-full bg-gray-100 text-gray-600">📍 {taskPlace}</span>}
                  {tags.map(tag => (
                    <span key={tag} className="font-dm text-xs font-semibold px-3 py-1 rounded-full bg-[#ff7700]/10 text-[#ff7700]">{tag}</span>
                  ))}
                </div>
                <DashboardHashtags tags={tags} />
                <a href="/ai-coach" className="block text-center py-3 rounded-xl font-dm text-sm font-semibold text-white bg-[#ff7700] hover:bg-[#ff7700]/90 transition mt-3">
                  ✨ Crear contenido →
                </a>
              </div>
            )
          })()}

          {/* CARD 2: Monthly goal rings */}
          <ProgressRings
            monthName={monthName}
            videosThisMonth={liveVideosThisMonth}
            videosRequired={videosRequired}
            gmvThisMonth={creator.gmv_this_month}
            gmvRequired={gmvRequired}
            accThisMonth={liveAccThisMonth}
            ttdThisMonth={liveTtdThisMonth}
            daysRemaining={daysRemainingInMonth}
          />
          <p className="text-center font-dm text-sm text-go-dark/70 -mt-2">
            <span className="font-semibold text-emerald-700">{liveVideosThisMonth} aprobados</span>
            <span className="mx-2 text-go-dark/30">·</span>
            <span className="font-semibold text-amber-700">{pendingThisMonth} pendientes de revisión</span>
          </p>
          {/* TODO: remove once counts are confirmed in production. */}
          <p className="text-center font-dm text-[11px] text-go-dark/40 -mt-2">
            [Debug] Aprobados en BD: {liveAccThisMonth} ACC · {liveTtdThisMonth} TTD · {liveVideosThisMonth} total este mes
          </p>

          {/* CARD 3: Challenge */}
          {challenge && (
            <div className="bg-white border border-[rgba(255,119,0,0.12)] rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🏆</span>
                  <h2 className="font-syne font-bold text-base text-[#1a0800]">{challenge.title}</h2>
                </div>
                <span className="font-dm text-xs font-semibold px-3 py-1 rounded-full bg-[#ff7700] text-white">{challengeDaysLeft} días</span>
              </div>
              {challenge.description && <p className="font-dm text-sm text-gray-500 mb-3">{challenge.description}</p>}
              {challenge.prize && (
                <div className="bg-[#fff8f2] border border-[rgba(255,119,0,0.08)] rounded-xl p-3 mb-4">
                  <p className="font-dm text-sm font-medium text-[#1a0800]">🎁 Premio: {challenge.prize}</p>
                </div>
              )}
              {challengeLeaderboard.length > 0 && (
                <div className="space-y-2">
                  <p className="font-dm text-xs font-semibold text-gray-400 uppercase tracking-wider">Top 3</p>
                  {challengeLeaderboard.map((c, i) => (
                    <div key={i} className="flex items-center gap-3 py-1.5">
                      <span className={`font-syne font-bold text-base w-6 text-center ${i === 0 ? 'text-[#ff7700]' : i === 1 ? 'text-[#ffa552]' : 'text-[#ff9ece]'}`}>#{i + 1}</span>
                      <span className="font-dm text-sm text-[#1a0800]">{c.name}</span>
                      <span className="font-dm text-xs text-gray-400 ml-auto">{c.score}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* CARD 4: Boost rápido */}
          <DashboardClient creatorId={creator.id} creatorName={creator.full_name} tiktokHandle={creator.tiktok_handle} />

          {/* CARD 5a: Mis Videos */}
          <MisVideosCard videos={myBoostsThisMonth} approved={liveVideosThisMonth} pending={pendingThisMonth} />

          {/* CARD 5: Tu crecimiento (vs mes pasado) */}
          {(() => {
            const prev = lastSnapshotRes.data as { acc_videos: number; ttd_videos: number; gmv: number } | null
            if (!prev) {
              return (
                <div className="bg-white border border-[rgba(255,119,0,0.12)] rounded-2xl p-5">
                  <h2 className="font-syne font-bold text-base text-[#1a0800] mb-2">📈 Tu crecimiento</h2>
                  <p className="font-dm text-sm text-gray-500">Este es tu primer mes — los datos de comparación estarán disponibles el próximo mes 🧡</p>
                </div>
              )
            }
            const accDelta = liveAccThisMonth - prev.acc_videos
            const ttdDelta = liveTtdThisMonth - prev.ttd_videos
            const gmvDelta = (creator.gmv_this_month ?? 0) - Number(prev.gmv ?? 0)
            const tone = (delta: number) => delta === 0 ? 'text-gray-500' : delta > 0 ? 'text-emerald-600' : 'text-red-600'
            const arrow = (delta: number) => delta === 0 ? '=' : delta > 0 ? '▲' : '▼'
            const Row = ({ label, current, last, delta, formatter }: { label: string; current: number; last: number; delta: number; formatter: (n: number) => string }) => (
              <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                <span className="font-dm text-sm font-semibold text-go-dark">{label}</span>
                <div className="flex items-center gap-3 text-xs font-dm">
                  <span className="text-go-dark/60">Este mes: <span className="font-bold text-go-dark">{formatter(current)}</span></span>
                  <span className="text-go-dark/40">·</span>
                  <span className="text-go-dark/60">Mes pasado: <span className="font-bold text-go-dark/80">{formatter(last)}</span></span>
                  <span className={`font-bold ${tone(delta)}`}>{arrow(delta)} {formatter(Math.abs(delta))}</span>
                </div>
              </div>
            )
            return (
              <div className="bg-white border border-[rgba(255,119,0,0.12)] rounded-2xl p-5">
                <h2 className="font-syne font-bold text-base text-[#1a0800] mb-3">📈 Tu crecimiento</h2>
                <Row label="ACC" current={liveAccThisMonth} last={prev.acc_videos} delta={accDelta} formatter={(n) => String(n)} />
                <Row label="TTD" current={liveTtdThisMonth} last={prev.ttd_videos} delta={ttdDelta} formatter={(n) => String(n)} />
                <Row label="GMV" current={creator.gmv_this_month ?? 0} last={Number(prev.gmv ?? 0)} delta={gmvDelta} formatter={(n) => `$${Math.round(n).toLocaleString('en-US')}`} />
              </div>
            )
          })()}

          {/* WhatsApp */}
          <div className="text-center">
            <a href="https://chat.whatsapp.com/IKy0BMc8ROl55Hm4r47C2Z?mode=gi_t" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-dm text-xs font-semibold text-white bg-[#25D366] hover:bg-[#20BD5A] px-4 py-2 rounded-full transition">
              💬 Grupo de WhatsApp
            </a>
          </div>
        </div>
      </main>
    </div>
  )
}
