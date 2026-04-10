import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Sidebar from '@/components/Sidebar'
import AnnouncementPopup from '@/components/AnnouncementPopup'
import DashboardClient from './DashboardClient'
import DashboardHashtags from './DashboardHashtags'
import { Creator, NivelRequirement, Announcement, Challenge, NIVEL_NAMES, NIVEL_COLORS } from '@/lib/types'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: creator } = await supabase.from('go_creators').select('*').eq('email', user.email!).single<Creator>()
  if (!creator) redirect('/')
  if (creator.status === 'pending') redirect('/pending')

  const admin = createAdminClient()
  const [announcementRes, nextNivelRes, challengeRes, leaderboardRes] = await Promise.all([
    admin.from('go_announcements').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    admin.from('go_nivel_requirements').select('*').eq('nivel', creator.nivel + 1).maybeSingle(),
    admin.from('go_challenges').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    admin.from('go_creators').select('id, full_name, nivel, videos_this_month, gmv_this_month, acc_this_month, ttd_this_month').eq('status', 'active').order('videos_this_month', { ascending: false }).limit(10),
  ])

  const announcement = announcementRes.data as Announcement | null
  const nextNivel = nextNivelRes.data as NivelRequirement | null
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
  const videosRequired = nextNivel?.total_videos_required ?? 0
  const gmvRequired = nextNivel?.gmv_required ?? 0
  const videosRemaining = Math.max(videosRequired - creator.videos_this_month, 0)
  const gmvRemaining = Math.max(gmvRequired - creator.gmv_this_month, 0)
  const videosProgress = videosRequired > 0 ? Math.min((creator.videos_this_month / videosRequired) * 100, 100) : 100

  let challengeDaysLeft = 0
  if (challenge) {
    challengeDaysLeft = Math.max(Math.ceil((new Date(challenge.end_date).getTime() - Date.now()) / 86400000), 0)
  }

  return (
    <div className="min-h-screen bg-[#fff8f2]">
      <Sidebar creatorName={creator.full_name} tiktokHandle={creator.tiktok_handle} nivel={creator.nivel} />

      {announcement && announcement.display_type !== 'popup' && (
        <div className="md:ml-[220px] bg-go-orange text-white px-4 py-3 font-dm text-sm">
          <div className="max-w-5xl mx-auto flex items-center gap-4">
            {announcement.image_url && (
              <img src={announcement.image_url} alt="" className="h-16 w-16 rounded-xl object-cover shrink-0" />
            )}
            <span className="flex-1">📢 {announcement.message}</span>
          </div>
        </div>
      )}
      {announcement && announcement.display_type === 'popup' && <AnnouncementPopup announcement={announcement} />}

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
              <div className="flex items-center gap-3 mt-4">
                <span className={`font-dm text-xs font-bold px-3 py-1 rounded-full ${nivelColor.bg} ${nivelColor.text}`}>Nivel {creator.nivel} · {NIVEL_NAMES[creator.nivel]}</span>
                <span className="font-dm text-xs text-[#1a0800]/50">{creator.videos_this_month} videos este mes</span>
              </div>
            </div>
          </div>

          {/* CARD 1: Tu tarea de hoy */}
          {(() => {
            const rawHashtags = creator.special_hashtags ?? '#tiktokgostay'
            const tags = rawHashtags.replace(/,/g, ' ').split(/\s+/).filter(Boolean).map(t => t.startsWith('#') ? t : `#${t}`)
            return (
              <div className="bg-white border-2 border-[#ff7700]/30 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">🎯</span>
                  <h2 className="font-syne font-bold text-lg text-[#1a0800]">Tu tarea de hoy</h2>
                </div>
                <p className="font-dm text-sm text-gray-500 mb-4">
                  {creator.nivel <= 2 ? 'Postea 1 video ACC de un hotel hoy. Usa el tag verde.' : 'Postea 1 video ACC o TTD hoy. Revisa tus Papaya Visits para inspiración.'}
                </p>
                <div className="flex flex-wrap gap-2 mb-3">
                  <span className="font-dm text-xs font-semibold px-3 py-1 rounded-full bg-blue-100 text-blue-700">ACC</span>
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

          {/* CARD 2: Progress */}
          <div className="bg-white border border-[rgba(255,119,0,0.12)] rounded-2xl p-5">
            <h2 className="font-syne font-bold text-base text-[#1a0800] mb-3">📅 Tu progreso este mes</h2>
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="font-dm text-xs font-semibold px-3 py-1.5 rounded-full bg-[#ff7700]/10 text-[#ff7700]">${creator.gmv_this_month.toLocaleString()} GMV</span>
              <span className="font-dm text-xs font-semibold px-3 py-1.5 rounded-full bg-gray-100 text-gray-600">{creator.videos_this_month} videos</span>
              <span className="font-dm text-xs font-semibold px-3 py-1.5 rounded-full bg-gray-100 text-gray-600">{creator.acc_this_month} ACC</span>
              <span className="font-dm text-xs font-semibold px-3 py-1.5 rounded-full bg-gray-100 text-gray-600">{creator.ttd_this_month} TTD</span>
            </div>
            {nextNivel && (
              <>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2">
                  <div className="h-full bg-gradient-to-r from-[#ff7700] to-[#ffa552] rounded-full transition-all" style={{ width: `${videosProgress}%` }} />
                </div>
                <p className="font-dm text-xs text-gray-400">Te faltan <span className="font-semibold text-[#1a0800]">{videosRemaining} videos</span> y <span className="font-semibold text-[#1a0800]">${gmvRemaining.toLocaleString()} GMV</span> para Nivel {creator.nivel + 1}</p>
              </>
            )}
          </div>

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
