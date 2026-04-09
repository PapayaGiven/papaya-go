import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import DailyChecklist from '@/components/DailyChecklist'
import { Creator, NivelRequirement, Announcement, NIVEL_NAMES, NIVEL_COLORS } from '@/lib/types'

const CHECKLIST_BY_NIVEL: Record<number, string[]> = {
  1: [
    'Postea 1 video ACC hoy',
    'Usa el tag verde (no el blanco)',
    'Agrega #tiktokgostay',
  ],
  2: [
    'Postea 1 video ACC hoy',
    'Revisa tus POIs disponibles',
    'Usa AI Coach para tu caption',
  ],
}

const CHECKLIST_DEFAULT = [
  'Postea 1 video ACC hoy',
  'Postea 1 video TTD esta semana',
  'Revisa tu portfolio',
]

export default async function DashboardPage() {
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

  // Fetch announcement and nivel requirements in parallel
  const [announcementResult, currentNivelResult, nextNivelResult] = await Promise.all([
    supabase
      .from('go_announcements')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single<Announcement>(),
    supabase
      .from('go_nivel_requirements')
      .select('*')
      .eq('nivel', creator.nivel)
      .single<NivelRequirement>(),
    supabase
      .from('go_nivel_requirements')
      .select('*')
      .eq('nivel', creator.nivel + 1)
      .single<NivelRequirement>(),
  ])

  const announcement = announcementResult.data
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const currentNivel = currentNivelResult.data
  const nextNivel = nextNivelResult.data

  const firstName = creator.full_name?.split(' ')[0] ?? 'Creadora'
  const nivelColor = NIVEL_COLORS[creator.nivel] ?? NIVEL_COLORS[1]

  // Progress calculations
  const videosProgress = nextNivel
    ? Math.min((creator.videos_this_month / nextNivel.total_videos_required) * 100, 100)
    : 100
  const gmvProgress = nextNivel
    ? Math.min((creator.gmv_this_month / nextNivel.gmv_required) * 100, 100)
    : 100
  const videosRemaining = nextNivel
    ? Math.max(nextNivel.total_videos_required - creator.videos_this_month, 0)
    : 0
  const gmvRemaining = nextNivel
    ? Math.max(nextNivel.gmv_required - creator.gmv_this_month, 0)
    : 0

  const checklistItems = CHECKLIST_BY_NIVEL[creator.nivel] ?? CHECKLIST_DEFAULT

  const stats = [
    { value: `$${creator.gmv_this_month.toLocaleString()}`, label: 'GMV este mes' },
    { value: creator.videos_this_month, label: 'Videos publicados' },
    { value: creator.acc_this_month, label: 'ACC completados' },
    { value: creator.ttd_this_month, label: 'TTD completados' },
  ]

  return (
    <div className="min-h-screen bg-go-light">
      <Sidebar
        creatorName={creator.full_name}
        tiktokHandle={creator.tiktok_handle}
        nivel={creator.nivel}
      />

      {/* Sun watermark */}
      <img
        src="https://mmhsulgcowhqimypglul.supabase.co/storage/v1/object/public/PGLOGOS/PapayaGo-Sun-Orange-39.png"
        alt=""
        className="fixed top-4 right-4 w-40 h-40 opacity-[0.04] pointer-events-none select-none z-0"
      />

      <main className="md:ml-[220px] pb-20 md:pb-0">
        {/* Announcement banner */}
        {announcement && (
          <div className="bg-go-orange text-white px-4 py-3 font-dm text-sm text-center">
            {announcement.image_url && (
              <img
                src={announcement.image_url}
                alt=""
                className="mx-auto mb-2 max-h-32 rounded-lg object-contain"
              />
            )}
            {announcement.message}
          </div>
        )}

        <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8">
          {/* Header */}
          <div>
            <h1 className="font-syne font-bold text-2xl text-go-dark">
              Dashboard
            </h1>
            <p className="font-dm text-sm text-gray-400 mt-1">
              ¡Hola, {firstName}!
            </p>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="bg-white border border-[rgba(255,119,0,0.12)] rounded-2xl p-5 flex flex-col gap-1"
              >
                <span className="font-syne font-bold text-2xl text-go-orange">
                  {stat.value}
                </span>
                <span className="font-dm text-xs text-gray-400">{stat.label}</span>
              </div>
            ))}
          </div>

          {/* Progress to next level */}
          {nextNivel && (
            <div className="bg-white border border-[rgba(255,119,0,0.12)] rounded-2xl p-5 md:p-6">
              <h2 className="font-syne font-bold text-lg text-go-dark mb-4">
                Progreso al siguiente nivel
              </h2>

              <div className="flex items-center gap-2 mb-5">
                <span
                  className={`font-dm text-xs font-bold px-2.5 py-1 rounded-full ${nivelColor.bg} ${nivelColor.text}`}
                >
                  Nivel {creator.nivel} · {NIVEL_NAMES[creator.nivel]}
                </span>
                <span className="text-gray-400">→</span>
                <span
                  className={`font-dm text-xs font-bold px-2.5 py-1 rounded-full ${(NIVEL_COLORS[creator.nivel + 1] ?? NIVEL_COLORS[4]).bg} ${(NIVEL_COLORS[creator.nivel + 1] ?? NIVEL_COLORS[4]).text}`}
                >
                  Nivel {creator.nivel + 1} · {NIVEL_NAMES[creator.nivel + 1] ?? 'Elite'}
                </span>
              </div>

              {/* Videos progress */}
              <div className="mb-4">
                <div className="flex justify-between mb-1">
                  <span className="font-dm text-sm text-gray-600">Videos</span>
                  <span className="font-dm text-sm font-semibold text-go-dark">
                    {creator.videos_this_month}/{nextNivel.total_videos_required}
                  </span>
                </div>
                <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-go-orange rounded-full transition-all"
                    style={{ width: `${videosProgress}%` }}
                  />
                </div>
              </div>

              {/* GMV progress */}
              <div className="mb-4">
                <div className="flex justify-between mb-1">
                  <span className="font-dm text-sm text-gray-600">GMV</span>
                  <span className="font-dm text-sm font-semibold text-go-dark">
                    ${creator.gmv_this_month.toLocaleString()}/${nextNivel.gmv_required.toLocaleString()}
                  </span>
                </div>
                <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-go-peach rounded-full transition-all"
                    style={{ width: `${gmvProgress}%` }}
                  />
                </div>
              </div>

              <p className="font-dm text-sm text-gray-500">
                Te faltan <span className="font-semibold text-go-dark">{videosRemaining} videos</span> y{' '}
                <span className="font-semibold text-go-dark">${gmvRemaining.toLocaleString()} GMV</span> para
                subir a{' '}
                <span className="font-semibold text-go-orange">
                  Nivel {creator.nivel + 1} ({NIVEL_NAMES[creator.nivel + 1] ?? 'Elite'})
                </span>
              </p>
            </div>
          )}

          {/* If max level */}
          {!nextNivel && (
            <div className="bg-white border border-[rgba(255,119,0,0.12)] rounded-2xl p-5 md:p-6 text-center">
              <span className="text-4xl mb-2 block">🏆</span>
              <h2 className="font-syne font-bold text-lg text-go-dark mb-1">
                ¡Estás en el nivel máximo!
              </h2>
              <p className="font-dm text-sm text-gray-500">
                Nivel {creator.nivel} · {NIVEL_NAMES[creator.nivel]}. Sigue creando contenido increíble.
              </p>
            </div>
          )}

          {/* Today's checklist */}
          <div className="bg-white border border-[rgba(255,119,0,0.12)] rounded-2xl p-5 md:p-6">
            <h2 className="font-syne font-bold text-lg text-go-dark mb-4">
              Checklist de hoy
            </h2>
            <DailyChecklist items={checklistItems} />
          </div>
        </div>
      </main>
    </div>
  )
}
