import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import { POI_TYPE_LABELS } from '@/lib/types'
import type { Creator, POI } from '@/lib/types'

const FILTER_TABS = [
  { label: 'Todos', value: '' },
  { label: 'Hoteles', value: 'hotel' },
  { label: 'Atracciones', value: 'attraction' },
  { label: 'Restaurantes', value: 'restaurant' },
]

export default async function POIsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: creator } = await supabase
    .from('creators')
    .select('*')
    .eq('id', user.id)
    .single<Creator>()

  if (!creator || creator.status !== 'active') redirect('/pending')

  const params = await searchParams
  const typeFilter = params.type ?? ''

  let query = supabase
    .from('pois')
    .select('*')
    .eq('is_active', true)
    .order('min_nivel', { ascending: true })

  if (typeFilter && ['hotel', 'attraction', 'restaurant'].includes(typeFilter)) {
    query = query.eq('type', typeFilter)
  }

  const { data: pois } = await query.returns<POI[]>()

  return (
    <>
      <Sidebar
        creatorName={creator.full_name}
        tiktokHandle={creator.tiktok_handle}
        nivel={creator.nivel}
      />

      <main className="md:ml-[220px] pb-20 md:pb-0 min-h-screen">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="font-syne font-extrabold text-2xl sm:text-3xl text-go-dark">
              Hoteles & Atracciones
            </h1>
            <p className="font-dm text-sm text-gray-500 mt-1">
              Explora los puntos de interés disponibles para tu nivel
            </p>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2 mb-8 overflow-x-auto pb-1">
            {FILTER_TABS.map((tab) => {
              const isActive = typeFilter === tab.value
              const href = tab.value ? `/pois?type=${tab.value}` : '/pois'
              return (
                <Link
                  key={tab.value}
                  href={href}
                  className={`px-4 py-2 rounded-xl font-dm text-sm font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-go-orange text-white'
                      : 'bg-white text-gray-600 border border-go-border hover:border-go-orange/30 hover:text-go-orange'
                  }`}
                >
                  {tab.label}
                </Link>
              )
            })}
          </div>

          {/* POI grid */}
          {!pois || pois.length === 0 ? (
            <div className="bg-white rounded-2xl border border-go-border p-10 text-center">
              <p className="text-4xl mb-3">📍</p>
              <p className="font-dm text-gray-500 text-sm">
                No se encontraron puntos de interés con este filtro.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {pois.map((poi) => {
                const isLocked = poi.min_nivel > creator.nivel
                const typeInfo = POI_TYPE_LABELS[poi.type] ?? {
                  label: poi.type,
                  color: 'bg-gray-100 text-gray-700',
                }

                if (isLocked) {
                  return (
                    <div
                      key={poi.id}
                      className="bg-white/60 rounded-2xl border border-go-border p-5 opacity-60 select-none"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-3xl grayscale">
                          {poi.image_emoji ?? '🔒'}
                        </span>
                        <span className={`font-dm text-[11px] font-semibold px-2.5 py-1 rounded-full ${typeInfo.color}`}>
                          {typeInfo.label}
                        </span>
                      </div>
                      <h3 className="font-syne font-bold text-base text-gray-400 mb-1">
                        {poi.name}
                      </h3>
                      <p className="font-dm text-xs text-gray-400 mb-4">
                        {poi.city}, {poi.state}
                      </p>
                      <div className="flex items-center gap-2 text-gray-400">
                        <span className="text-lg">🔒</span>
                        <span className="font-dm text-xs font-medium">
                          Disponible en Nivel {poi.min_nivel}
                        </span>
                      </div>
                    </div>
                  )
                }

                return (
                  <div
                    key={poi.id}
                    className="bg-white rounded-2xl border border-go-border p-5 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-3xl">{poi.image_emoji ?? '📍'}</span>
                      <span className={`font-dm text-[11px] font-semibold px-2.5 py-1 rounded-full ${typeInfo.color}`}>
                        {typeInfo.label}
                      </span>
                    </div>
                    <h3 className="font-syne font-bold text-base text-go-dark mb-1">
                      {poi.name}
                    </h3>
                    <p className="font-dm text-xs text-gray-500 mb-3">
                      {poi.city}, {poi.state}
                    </p>
                    <div className="space-y-1.5 mb-4">
                      <p className="font-dm text-xs text-gray-600">
                        <span className="font-semibold text-go-dark">Comision:</span>{' '}
                        {poi.commission}
                      </p>
                      {poi.perk && (
                        <p className="font-dm text-xs text-gray-600">
                          <span className="font-semibold text-go-dark">Perk:</span>{' '}
                          {poi.perk}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Link
                        href={`/ai-coach?poi=${poi.id}`}
                        className="flex-1 text-center py-2 rounded-xl font-dm text-xs font-semibold text-white bg-go-orange hover:bg-go-orange/90 transition"
                      >
                        Usar en AI Coach
                      </Link>
                      {poi.capcut_template_url && (
                        <a
                          href={poi.capcut_template_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-2 rounded-xl font-dm text-xs font-semibold text-go-orange border border-go-orange hover:bg-go-orange/5 transition"
                        >
                          CapCut &rarr;
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </>
  )
}
