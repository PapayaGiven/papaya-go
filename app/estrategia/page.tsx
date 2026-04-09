import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import { Creator, NivelRequirement, POI, NIVEL_NAMES, POI_TYPE_LABELS } from '@/lib/types'

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

  // Fetch nivel requirements and suggested POIs in parallel
  const [nivelResult, poisResult] = await Promise.all([
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
  ])

  const nivelReq = nivelResult.data
  const suggestedPois = poisResult.data ?? []

  // Days remaining in month
  const now = new Date()
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysRemaining = lastDay - now.getDate()

  // GMV progress
  const gmvGoal = nivelReq?.gmv_required ?? 0
  const gmvProgress = gmvGoal > 0 ? Math.min((creator.gmv_this_month / gmvGoal) * 100, 100) : 0

  // Video tracker status helpers
  function trackerStatus(current: number, required: number) {
    if (current >= required) return { color: 'bg-green-50 border-green-200', text: 'text-green-700', badge: 'Meta cumplida ✓' }
    const pct = required > 0 ? current / required : 0
    // Consider "behind" if less than proportional progress through the month
    const monthProgress = 1 - daysRemaining / lastDay
    if (pct < monthProgress * 0.5) return { color: 'bg-red-50 border-red-200', text: 'text-red-700', badge: 'Atrasada' }
    return { color: 'bg-orange-50 border-orange-200', text: 'text-orange-700', badge: 'En progreso' }
  }

  const accRequired = nivelReq?.acc_required ?? 0
  const ttdRequired = nivelReq?.ttd_required ?? 0
  const totalRequired = nivelReq?.total_videos_required ?? 0

  const accStatus = trackerStatus(creator.acc_this_month, accRequired)
  const ttdStatus = trackerStatus(creator.ttd_this_month, ttdRequired)
  const totalStatus = trackerStatus(creator.videos_this_month, totalRequired)

  const videoTrackers = [
    { label: 'ACC', current: creator.acc_this_month, required: accRequired, ...accStatus },
    { label: 'TTD', current: creator.ttd_this_month, required: ttdRequired, ...ttdStatus },
    { label: 'Total', current: creator.videos_this_month, required: totalRequired, ...totalStatus },
  ]

  const weeklyPlan = [
    {
      day: 'Lunes',
      type: 'ACC',
      poiType: 'Hotel',
      description: 'Video ACC en hotel',
      tip: 'Graba el recorrido del check-in al cuarto. Usa la plantilla de CapCut para ACC.',
    },
    {
      day: 'Miércoles',
      type: 'TTD',
      poiType: 'Atracción',
      description: 'Video TTD de experiencia',
      tip: 'Muestra tu reacción genuina. Los primeros 3 segundos son clave para el hook.',
    },
    {
      day: 'Viernes',
      type: 'Orgánico',
      poiType: 'Restaurante',
      description: 'Video orgánico de restaurante',
      tip: 'Enfócate en la comida y el ambiente. Usa trending sounds para mayor alcance.',
    },
  ]

  const typeColors: Record<string, string> = {
    ACC: 'bg-blue-100 text-blue-700',
    TTD: 'bg-purple-100 text-purple-700',
    'Orgánico': 'bg-emerald-100 text-emerald-700',
  }

  return (
    <div className="min-h-screen bg-go-light">
      <Sidebar
        creatorName={creator.full_name}
        tiktokHandle={creator.tiktok_handle}
        nivel={creator.nivel}
      />

      <main className="md:ml-[220px] pb-20 md:pb-0">
        <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
          {/* Header */}
          <div>
            <h1 className="font-syne font-extrabold text-2xl md:text-3xl text-go-dark">
              🎯 Mi Estrategia
            </h1>
            <p className="font-dm text-gray-500 mt-1">
              Nivel {creator.nivel} · {NIVEL_NAMES[creator.nivel] ?? 'Explorer'} — {daysRemaining} días restantes este mes
            </p>
          </div>

          {/* Monthly goal */}
          <div className="bg-white border border-go-border rounded-2xl p-5 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-lg">💰</span>
                <h2 className="font-syne font-extrabold text-lg text-go-dark">Meta mensual de GMV</h2>
              </div>
              <span className="font-dm text-sm text-gray-500">{daysRemaining} días restantes</span>
            </div>

            <div className="flex items-end gap-2 mb-3">
              <span className="font-syne font-extrabold text-3xl text-go-dark">
                ${creator.gmv_this_month.toLocaleString()}
              </span>
              <span className="font-dm text-sm text-gray-400 mb-1">
                / ${gmvGoal.toLocaleString()}
              </span>
            </div>

            <div className="h-4 bg-gray-100 rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-gradient-to-r from-go-orange to-go-peach rounded-full transition-all"
                style={{ width: `${gmvProgress}%` }}
              />
            </div>
            <p className="font-dm text-sm text-gray-500">
              {gmvProgress >= 100
                ? '🎉 ¡Meta cumplida! Sigue generando para subir de nivel.'
                : `Te faltan $${Math.max(gmvGoal - creator.gmv_this_month, 0).toLocaleString()} para cumplir tu meta.`}
            </p>
          </div>

          {/* Video tracker */}
          <div className="bg-white border border-go-border rounded-2xl p-5 md:p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">🎬</span>
              <h2 className="font-syne font-extrabold text-lg text-go-dark">Video Tracker</h2>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {videoTrackers.map((tracker) => (
                <div
                  key={tracker.label}
                  className={`border rounded-2xl p-4 text-center ${tracker.color}`}
                >
                  <span className="font-dm text-xs font-bold uppercase tracking-wide block mb-2">
                    {tracker.label}
                  </span>
                  <span className={`font-syne font-extrabold text-2xl md:text-3xl block ${tracker.text}`}>
                    {tracker.current}/{tracker.required}
                  </span>
                  <span className={`font-dm text-xs font-semibold mt-1 block ${tracker.text}`}>
                    {tracker.badge}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Suggested POIs */}
          {suggestedPois.length > 0 && (
            <div className="bg-white border border-go-border rounded-2xl p-5 md:p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">📍</span>
                <h2 className="font-syne font-extrabold text-lg text-go-dark">
                  POIs sugeridos esta semana
                </h2>
              </div>

              <div className="grid md:grid-cols-3 gap-3">
                {suggestedPois.map((poi) => {
                  const typeInfo = POI_TYPE_LABELS[poi.type] ?? {
                    label: poi.type,
                    color: 'bg-gray-100 text-gray-700',
                  }
                  return (
                    <div
                      key={poi.id}
                      className="border border-go-border rounded-xl p-4 hover:border-go-orange/40 transition-colors"
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <span className="text-2xl">{poi.image_emoji ?? '📍'}</span>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-dm text-sm font-semibold text-go-dark truncate">
                            {poi.name}
                          </h3>
                          <span
                            className={`inline-block font-dm text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 ${typeInfo.color}`}
                          >
                            {typeInfo.label}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1 mb-3">
                        <p className="font-dm text-xs text-gray-500">
                          <span className="font-semibold text-go-dark">Comisión:</span> {poi.commission}
                        </p>
                        {poi.perk && (
                          <p className="font-dm text-xs text-gray-500">
                            <span className="font-semibold text-go-dark">Perk:</span> {poi.perk}
                          </p>
                        )}
                      </div>

                      <Link
                        href={`/ai-coach?poi=${poi.id}`}
                        className="font-dm text-xs font-semibold text-go-orange hover:text-orange-600 transition-colors"
                      >
                        Ver en AI Coach →
                      </Link>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Weekly plan */}
          <div className="bg-white border border-go-border rounded-2xl p-5 md:p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">📅</span>
              <h2 className="font-syne font-extrabold text-lg text-go-dark">Plan semanal</h2>
            </div>

            <div className="grid md:grid-cols-3 gap-3">
              {weeklyPlan.map((day) => (
                <div
                  key={day.day}
                  className="border border-go-border rounded-xl p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-syne font-extrabold text-sm text-go-dark">{day.day}</span>
                    <span
                      className={`font-dm text-[10px] font-bold px-2 py-0.5 rounded-full ${typeColors[day.type] ?? 'bg-gray-100 text-gray-700'}`}
                    >
                      {day.type}
                    </span>
                  </div>
                  <p className="font-dm text-sm font-semibold text-go-dark mb-1">{day.description}</p>
                  <p className="font-dm text-xs text-gray-400 mb-2">📍 {day.poiType}</p>
                  <p className="font-dm text-xs text-gray-500 leading-relaxed">
                    💡 {day.tip}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
