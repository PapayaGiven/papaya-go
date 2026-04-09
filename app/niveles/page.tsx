import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import { NIVEL_NAMES, NIVEL_COLORS } from '@/lib/types'
import type { Creator, NivelRequirement, PortfolioSubmission } from '@/lib/types'
import PortfolioForm from './PortfolioForm'

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700' },
  reviewed: { label: 'En revision', color: 'bg-blue-100 text-blue-700' },
  pitched: { label: 'Pitcheado ✓', color: 'bg-green-100 text-green-700' },
}

export default async function NivelesPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: creator } = await supabase
    .from('go_creators')
    .select('*')
    .eq('email', user.email!)
    .single<Creator>()

  if (!creator) redirect('/pending')

  const { data: requirements } = await supabase
    .from('go_nivel_requirements')
    .select('*')
    .order('nivel', { ascending: true })
    .returns<NivelRequirement[]>()

  const { data: submissions } = await supabase
    .from('go_portfolio_submissions')
    .select('*')
    .eq('creator_id', user.id)
    .order('created_at', { ascending: false })
    .returns<PortfolioSubmission[]>()

  const allNiveles = requirements ?? []
  const latestSubmission = submissions && submissions.length > 0 ? submissions[0] : null
  const nextNivel = allNiveles.find((r) => r.nivel === creator.nivel + 1) ?? null

  return (
    <>
      <Sidebar
        creatorName={creator.full_name}
        tiktokHandle={creator.tiktok_handle}
        nivel={creator.nivel}
      />

      <main className="md:ml-[220px] pb-20 md:pb-0 min-h-screen">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="font-syne font-extrabold text-2xl sm:text-3xl text-go-dark">
              Niveles
            </h1>
            <p className="font-dm text-sm text-gray-500 mt-1">
              Sube de nivel para desbloquear mas perks y oportunidades
            </p>
          </div>

          {/* Nivel cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {allNiveles.map((req) => {
              const isCurrent = req.nivel === creator.nivel
              const colors = NIVEL_COLORS[req.nivel] ?? NIVEL_COLORS[1]
              const name = NIVEL_NAMES[req.nivel] ?? `Nivel ${req.nivel}`

              return (
                <div
                  key={req.nivel}
                  className={`bg-white rounded-2xl border-2 p-5 relative transition-shadow ${
                    isCurrent
                      ? 'border-go-orange shadow-md'
                      : `border-t-4 border-go-border ${colors.border}`
                  }`}
                  style={
                    !isCurrent
                      ? { borderTopColor: `var(--tw-border-opacity, 1)` }
                      : undefined
                  }
                >
                  {/* Colored top stripe for non-current cards */}
                  {!isCurrent && (
                    <div
                      className={`absolute top-0 left-0 right-0 h-1 rounded-t-2xl ${colors.bg}`}
                    />
                  )}

                  {isCurrent && (
                    <span className="absolute -top-3 right-4 font-dm text-[11px] font-bold px-3 py-1 rounded-full bg-go-orange text-white">
                      Tu nivel actual
                    </span>
                  )}

                  <div className="flex items-center gap-3 mb-4">
                    <span
                      className={`font-syne font-extrabold text-lg px-3 py-1 rounded-xl ${colors.bg} ${colors.text}`}
                    >
                      {req.nivel}
                    </span>
                    <h3 className="font-syne font-bold text-lg text-go-dark">
                      {name}
                    </h3>
                  </div>

                  <div className="space-y-2 mb-4">
                    <p className="font-dm text-xs text-gray-600">
                      <span className="font-semibold">ACC:</span> {req.acc_required} videos
                    </p>
                    <p className="font-dm text-xs text-gray-600">
                      <span className="font-semibold">TTD:</span> {req.ttd_required} videos
                    </p>
                    <p className="font-dm text-xs text-gray-600">
                      <span className="font-semibold">Total videos:</span>{' '}
                      {req.total_videos_required}
                    </p>
                    <p className="font-dm text-xs text-gray-600">
                      <span className="font-semibold">GMV:</span> $
                      {req.gmv_required.toLocaleString()} USD
                    </p>
                  </div>

                  {req.perks && (
                    <div className="pt-3 border-t border-go-border">
                      <p className="font-dm text-xs font-semibold text-go-dark mb-1">
                        Perks:
                      </p>
                      <p className="font-dm text-xs text-gray-600">{req.perks}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Progress card */}
          {nextNivel && (
            <div className="bg-white rounded-2xl border border-go-border p-6 mb-8">
              <h2 className="font-syne font-bold text-lg text-go-dark mb-1">
                Tu progreso actual
              </h2>
              <p className="font-dm text-sm text-gray-500 mb-5">
                Para subir a Nivel {nextNivel.nivel} ({NIVEL_NAMES[nextNivel.nivel]})
                necesitas:
              </p>

              <div className="space-y-3">
                <ProgressItem
                  label={`ACC: ${creator.acc_this_month} / ${nextNivel.acc_required} videos`}
                  met={creator.acc_this_month >= nextNivel.acc_required}
                />
                <ProgressItem
                  label={`TTD: ${creator.ttd_this_month} / ${nextNivel.ttd_required} videos`}
                  met={creator.ttd_this_month >= nextNivel.ttd_required}
                />
                <ProgressItem
                  label={`Total videos: ${creator.videos_this_month} / ${nextNivel.total_videos_required}`}
                  met={creator.videos_this_month >= nextNivel.total_videos_required}
                />
                <ProgressItem
                  label={`GMV: $${creator.gmv_total.toLocaleString()} / $${nextNivel.gmv_required.toLocaleString()} USD`}
                  met={creator.gmv_total >= nextNivel.gmv_required}
                />
              </div>
            </div>
          )}

          {!nextNivel && creator.nivel >= 4 && (
            <div className="bg-white rounded-2xl border border-go-border p-6 mb-8 text-center">
              <p className="text-4xl mb-3">🏆</p>
              <h2 className="font-syne font-bold text-lg text-go-dark mb-1">
                Estas en el nivel maximo
              </h2>
              <p className="font-dm text-sm text-gray-500">
                Felicidades, eres parte del nivel Elite de Papaya GO.
              </p>
            </div>
          )}

          {/* Portfolio section — only for nivel >= 3 */}
          {creator.nivel >= 3 && (
            <div className="bg-white rounded-2xl border border-go-border p-6">
              <h2 className="font-syne font-bold text-lg text-go-dark mb-1">
                📁 Tu Portfolio — Papaya te pitchea a marcas
              </h2>
              <p className="font-dm text-sm text-gray-500 mb-6">
                Sube tu informacion y Papaya GO te presentara directamente a marcas
                que buscan creadoras como tu.
              </p>

              {latestSubmission ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="font-dm text-sm font-medium text-go-dark">
                      Estado:
                    </span>
                    <span
                      className={`font-dm text-xs font-semibold px-3 py-1 rounded-full ${
                        STATUS_LABELS[latestSubmission.status]?.color ??
                        'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {STATUS_LABELS[latestSubmission.status]?.label ??
                        latestSubmission.status}
                    </span>
                  </div>

                  {latestSubmission.media_kit_url && (
                    <p className="font-dm text-xs text-gray-600">
                      <span className="font-semibold">Media Kit:</span>{' '}
                      <a
                        href={latestSubmission.media_kit_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-go-orange hover:underline"
                      >
                        {latestSubmission.media_kit_url}
                      </a>
                    </p>
                  )}

                  {latestSubmission.stats_screenshot_url && (
                    <p className="font-dm text-xs text-gray-600">
                      <span className="font-semibold">Stats Screenshot:</span>{' '}
                      <a
                        href={latestSubmission.stats_screenshot_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-go-orange hover:underline"
                      >
                        {latestSubmission.stats_screenshot_url}
                      </a>
                    </p>
                  )}

                  {latestSubmission.video_links.length > 0 && (
                    <div>
                      <p className="font-dm text-xs font-semibold text-go-dark mb-1">
                        Videos enviados:
                      </p>
                      <ul className="space-y-1">
                        {latestSubmission.video_links.map((link, i) => (
                          <li key={i}>
                            <a
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-dm text-xs text-go-orange hover:underline"
                            >
                              {link}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <p className="font-dm text-xs text-gray-400">
                    Enviado el{' '}
                    {new Date(latestSubmission.created_at).toLocaleDateString('es-MX', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              ) : (
                <PortfolioForm />
              )}
            </div>
          )}
        </div>
      </main>
    </>
  )
}

function ProgressItem({ label, met }: { label: string; met: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
          met ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-go-orange'
        }`}
      >
        {met ? '✓' : '✗'}
      </span>
      <span
        className={`font-dm text-sm ${
          met ? 'text-green-700' : 'text-gray-700'
        }`}
      >
        {label}
      </span>
    </div>
  )
}
