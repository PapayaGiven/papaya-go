import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Sidebar from '@/components/Sidebar'
import { Creator, NivelRequirement, POI, NIVEL_NAMES, POI_TYPE_LABELS } from '@/lib/types'
import MediaKitCTA from './MediaKitCTA'
import HashtagsCard from './HashtagsCard'

export default async function EstrategiaPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  const { data: creator } = await supabase
    .from('go_creators')
    .select('*')
    .eq('email', user.email!)
    .single<Creator>()

  if (!creator) {
    redirect('/')
  }

  if (creator.status === 'pending') {
    redirect('/pending')
  }

  const admin = createAdminClient()

  // Fetch nivel requirements, suggested POIs, and weekly plan in parallel
  const [nivelResult, poisResult, weeklyPlanResult] = await Promise.all([
    supabase
      .from('go_nivel_requirements')
      .select('*')
      .eq('nivel', creator.nivel)
      .single<NivelRequirement>(),
    supabase
      .from('go_pois')
      .select('*')
      .eq('is_active', true)
      .lte('min_nivel', creator.nivel)
      .limit(3)
      .returns<POI[]>(),
    admin
      .from('go_weekly_plan')
      .select('*')
      .eq('is_active', true)
      .order('sort_order'),
  ])

  const nivelReq = nivelResult.data
  const suggestedPois = poisResult.data ?? []

  // Days remaining in month
  const now = new Date()
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysRemaining = lastDay - now.getDate()

  // Goals
  const gmvGoal = creator.gmv_goal ?? nivelReq?.gmv_required ?? 500
  const accGoal = creator.acc_goal ?? nivelReq?.acc_required ?? 3
  const ttdGoal = creator.ttd_goal ?? nivelReq?.ttd_required ?? 1
  const totalGoal = (creator.acc_goal != null || creator.ttd_goal != null)
    ? (creator.acc_goal ?? 0) + (creator.ttd_goal ?? 0)
    : nivelReq?.total_videos_required ?? 0

  // GMV progress
  const gmvProgress = gmvGoal > 0 ? Math.min((creator.gmv_this_month / gmvGoal) * 100, 100) : 0

  // Video tracker helpers
  function trackerColor(current: number, required: number) {
    if (current >= required) return { border: 'border-b-[3px] border-b-green-500', text: 'text-green-600' }
    if (current > 0) return { border: 'border-b-[3px] border-b-[#ff7700]', text: 'text-[#ff7700]' }
    return { border: 'border-b-[3px] border-b-red-400', text: 'text-red-500' }
  }

  const trackers = [
    { label: 'ACC', current: creator.acc_this_month, required: accGoal, ...trackerColor(creator.acc_this_month, accGoal) },
    { label: 'TTD', current: creator.ttd_this_month, required: ttdGoal, ...trackerColor(creator.ttd_this_month, ttdGoal) },
    { label: 'Total', current: creator.videos_this_month, required: totalGoal, ...trackerColor(creator.videos_this_month, totalGoal) },
  ]

  // Weekly plan from database (fallback to defaults if empty)
  const dbPlan = (weeklyPlanResult.data ?? []) as { day_es: string; video_type: string; title: string; description: string | null; tip: string | null }[]
  const weeklyPlan = dbPlan.length > 0
    ? dbPlan.map(p => ({ day: p.day_es, type: p.video_type ?? 'general', description: p.title, tip: p.tip ?? '' }))
    : [
        { day: 'Lunes', type: 'ACC', description: 'Video ACC en hotel', tip: 'Graba el recorrido del check-in al cuarto.' },
        { day: 'Miércoles', type: 'TTD', description: 'Video TTD de experiencia', tip: 'Muestra tu reacción genuina.' },
        { day: 'Viernes', type: 'Orgánico', description: 'Video orgánico de restaurante', tip: 'Enfócate en la comida y el ambiente.' },
      ]

  const typeColors: Record<string, string> = {
    ACC: 'bg-blue-100 text-blue-700',
    TTD: 'bg-purple-100 text-purple-700',
    'Orgánico': 'bg-emerald-100 text-emerald-700',
  }

  const nivelName = NIVEL_NAMES[creator.nivel] ?? 'Explorer'

  return (
    <div className="min-h-screen bg-[#fff8f2]">
      <Sidebar
        creatorName={creator.full_name}
        tiktokHandle={creator.tiktok_handle}
        nivel={creator.nivel}
      />
      <img
        src="https://mmhsulgcowhqimypglul.supabase.co/storage/v1/object/public/PGLOGOS/PapayaGo-Sun-Orange-39.png"
        alt=""
        className="fixed top-4 right-4 w-40 h-40 opacity-[0.04] pointer-events-none select-none z-0"
        aria-hidden="true"
      />

      <main className="md:ml-[220px] pb-20 md:pb-0">
        <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">

          {/* ── 1. HEADER PILLS ── */}
          <div className="flex flex-wrap gap-2">
            <span className="font-dm text-xs font-semibold px-3 py-1.5 rounded-full bg-[#ff7700]/10 text-[#ff7700]">
              Nivel {creator.nivel} · {nivelName}
            </span>
            <span className="font-dm text-xs font-semibold px-3 py-1.5 rounded-full bg-gray-100 text-gray-600">
              {daysRemaining} días restantes
            </span>
            <span className="font-dm text-xs font-semibold px-3 py-1.5 rounded-full bg-gray-100 text-gray-600">
              Meta: ${gmvGoal.toLocaleString()} GMV
            </span>
          </div>

          {/* ── HASHTAGS ── */}
          {creator.special_hashtags && (
            <HashtagsCard hashtags={creator.special_hashtags} />
          )}

          {/* ── 2. META MENSUAL ── */}
          <div className="bg-white border border-[rgba(255,119,0,0.1)] rounded-2xl p-5 relative overflow-hidden">
            <div className="flex items-start justify-between mb-4">
              <h2 className="font-syne font-bold text-base border-l-[3px] border-[#ff7700] pl-3 text-gray-900">
                Meta mensual
              </h2>
              <span className="font-dm text-xs font-semibold px-3 py-1 rounded-full bg-[#ff7700] text-white">
                {daysRemaining} días
              </span>
            </div>

            <div className="flex items-end gap-2 mb-4">
              <span className="font-syne font-bold text-4xl text-[#ff7700]">
                ${creator.gmv_this_month.toLocaleString()}
              </span>
              <span className="font-dm text-sm text-gray-400 mb-1">
                / ${gmvGoal.toLocaleString()}
              </span>
            </div>

            <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-gradient-to-r from-[#ff7700] to-[#ffa552] rounded-full transition-all duration-500"
                style={{ width: `${gmvProgress}%` }}
              />
            </div>

            <p className="font-dm text-sm text-gray-400">
              {gmvProgress >= 100
                ? '¡Meta cumplida! Sigue generando para subir de nivel.'
                : `Te faltan $${Math.max(gmvGoal - creator.gmv_this_month, 0).toLocaleString()} para tu meta`}
            </p>
          </div>

          {/* ── 4. VIDEO TRACKER ── */}
          <div>
            <h2 className="font-syne font-bold text-base border-l-[3px] border-[#ff7700] pl-3 text-gray-900 mb-4">
              Video Tracker
            </h2>
            <div className="grid grid-cols-3 gap-4">
              {trackers.map((t) => (
                <div
                  key={t.label}
                  className={`bg-white border border-[rgba(255,119,0,0.1)] rounded-2xl p-5 text-center ${t.border}`}
                >
                  <p className="font-dm text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                    {t.label}
                  </p>
                  <p className="font-syne font-bold text-3xl text-gray-900">
                    {t.current}<span className="text-gray-300">/{t.required}</span>
                  </p>
                  <p className={`font-dm text-xs font-semibold mt-2 ${t.text}`}>
                    {t.current >= t.required ? 'Meta cumplida ✓' : t.current > 0 ? 'En progreso' : 'Sin empezar'}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* ── 5. POIS SUGERIDOS ── */}
          {suggestedPois.length > 0 && (
            <div>
              <h2 className="font-syne font-bold text-base border-l-[3px] border-[#ff7700] pl-3 text-gray-900 mb-4">
                POIs sugeridos esta semana
              </h2>
              <div className="flex gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-3 md:overflow-visible">
                {suggestedPois.map((poi) => {
                  const typeInfo = POI_TYPE_LABELS[poi.type] ?? {
                    label: poi.type,
                    color: 'bg-gray-100 text-gray-700',
                  }
                  return (
                    <div
                      key={poi.id}
                      className="bg-white border border-[rgba(255,119,0,0.1)] rounded-2xl p-5 min-w-[220px] md:min-w-0 flex flex-col"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-3xl">{poi.image_emoji ?? '📍'}</span>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-dm text-sm font-semibold text-gray-900 truncate">
                            {poi.name}
                          </h3>
                          <span
                            className={`inline-block font-dm text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 ${typeInfo.color}`}
                          >
                            {typeInfo.label}
                          </span>
                        </div>
                      </div>

                      <p className="font-dm text-sm font-semibold text-[#ff7700] mb-1">
                        {poi.commission}
                      </p>
                      {poi.perk && (
                        <p className="font-dm text-xs text-gray-400 mb-3">{poi.perk}</p>
                      )}

                      <Link
                        href={`/ai-coach?poi=${poi.id}`}
                        className="font-dm text-xs font-semibold text-[#ff7700] hover:text-orange-600 transition-colors mt-auto"
                      >
                        Usar en AI &rarr;
                      </Link>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── 6. PLAN SEMANAL ── */}
          <div>
            <h2 className="font-syne font-bold text-base border-l-[3px] border-[#ff7700] pl-3 text-gray-900 mb-4">
              Plan semanal
            </h2>
            <div className="grid md:grid-cols-3 gap-4">
              {weeklyPlan.map((day, i) => (
                <div
                  key={day.day}
                  className={`border border-[rgba(255,119,0,0.1)] rounded-2xl p-5 ${
                    i % 2 === 0 ? 'bg-[#fff8f2]' : 'bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-syne font-bold text-sm text-gray-900">{day.day}</span>
                    <span
                      className={`font-dm text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                        typeColors[day.type] ?? 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {day.type}
                    </span>
                  </div>
                  <p className="font-dm text-sm text-gray-700 mb-2">{day.description}</p>
                  <p className="font-dm text-xs text-gray-400 italic leading-relaxed">{day.tip}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── 7. PORTFOLIO CTA ── */}
          <MediaKitCTA creatorId={creator.id} existingUrl={creator.mediakit_url} />

        </div>
      </main>
    </div>
  )
}
