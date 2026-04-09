import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import Link from 'next/link'

interface ViralVideo {
  id: string
  tiktok_url: string
  tiktok_handle: string | null
  views: string | null
  video_type: string | null
  is_active: boolean
}

function parseViews(views: string | null): number {
  if (!views) return 0
  const cleaned = views.trim().toUpperCase()
  const num = parseFloat(cleaned)
  if (isNaN(num)) return 0
  if (cleaned.endsWith('M')) return num * 1_000_000
  if (cleaned.endsWith('K')) return num * 1_000
  return num
}

function formatViews(views: string | null): string {
  if (!views) return '0'
  return views.trim()
}

export default async function ViralVideosPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: creatorData } = await supabase
    .from('go_creators')
    .select('*')
    .eq('email', user.email!)
    .single()

  if (!creatorData) redirect('/')
  if (creatorData.status === 'pending') redirect('/pending')

  const admin = createAdminClient()
  const params = await searchParams
  const activeType = params.type === 'TTD' ? 'TTD' : 'ACC'

  const { data: videos } = await admin
    .from('go_viral_videos')
    .select('*')
    .eq('is_active', true)
    .eq('video_type', activeType)

  // Sort by parsed views descending
  const items = ((videos ?? []) as ViralVideo[]).sort(
    (a, b) => parseViews(b.views) - parseViews(a.views)
  )

  return (
    <div className="min-h-screen bg-go-light">
      <Sidebar creatorName={creatorData.full_name} tiktokHandle={creatorData.tiktok_handle} nivel={creatorData.nivel} />
      <main className="md:ml-[220px] pb-20 md:pb-0 min-h-screen">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
          <div className="mb-6">
            <h1 className="font-syne font-extrabold text-2xl text-go-dark mb-1">🔥 Videos Virales</h1>
            <p className="font-dm text-sm text-gray-500">Los videos con más views en TikTok GO este mes.</p>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6">
            <Link
              href="/viral-videos?type=ACC"
              className={`font-dm text-sm font-semibold px-5 py-2.5 rounded-xl transition ${
                activeType === 'ACC'
                  ? 'bg-go-orange text-white'
                  : 'bg-white border border-go-border text-gray-600 hover:border-go-orange hover:text-go-orange'
              }`}
            >
              🏨 Hoteles
            </Link>
            <Link
              href="/viral-videos?type=TTD"
              className={`font-dm text-sm font-semibold px-5 py-2.5 rounded-xl transition ${
                activeType === 'TTD'
                  ? 'bg-go-pink text-white'
                  : 'bg-white border border-go-border text-gray-600 hover:border-go-pink hover:text-go-pink'
              }`}
            >
              🎡 Atracciones
            </Link>
          </div>

          {/* Ranked list */}
          {items.length === 0 ? (
            <div className="bg-white rounded-2xl border border-go-border p-10 text-center">
              <p className="text-4xl mb-3">🎬</p>
              <p className="font-dm text-gray-500 text-sm">
                Aún no hay videos de {activeType === 'ACC' ? 'hoteles' : 'atracciones'}.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((v, idx) => (
                <div
                  key={v.id}
                  className={`bg-white rounded-2xl border overflow-hidden flex items-center gap-4 px-5 py-4 transition hover:shadow-sm ${
                    idx === 0 ? 'border-go-orange/40' : idx === 1 ? 'border-go-peach/40' : idx === 2 ? 'border-go-pink/40' : 'border-go-border'
                  }`}
                >
                  {/* Rank */}
                  <span className={`font-syne font-extrabold text-2xl shrink-0 w-10 text-center ${
                    idx === 0 ? 'text-go-orange' : idx === 1 ? 'text-go-peach' : idx === 2 ? 'text-go-pink' : 'text-gray-300'
                  }`}>
                    #{idx + 1}
                  </span>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-dm text-sm font-bold text-go-dark truncate">
                      {v.tiktok_handle ? `@${v.tiktok_handle.replace(/^@/, '')}` : 'Creator'}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-dm text-xs text-gray-500 flex items-center gap-1">
                        👁 {formatViews(v.views)}
                      </span>
                      <span className={`font-dm text-xs font-bold px-2 py-0.5 rounded-full ${
                        v.video_type === 'ACC' ? 'bg-go-orange/10 text-go-orange' : 'bg-go-pink/20 text-pink-700'
                      }`}>
                        {v.video_type}
                      </span>
                    </div>
                  </div>

                  {/* CTA */}
                  <a
                    href={v.tiktok_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 font-dm text-xs font-semibold text-go-orange hover:text-go-orange/80 transition"
                  >
                    Ver en TikTok →
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
