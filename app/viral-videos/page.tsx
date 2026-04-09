import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import Link from 'next/link'

interface ViralVideo {
  id: string
  tiktok_url: string
  video_type: string | null
  is_active: boolean
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
    .order('created_at', { ascending: true })

  const items = (videos ?? []) as ViralVideo[]

  return (
    <div className="min-h-screen bg-go-light">
      <Sidebar creatorName={creatorData.full_name} tiktokHandle={creatorData.tiktok_handle} nivel={creatorData.nivel} />
      <main className="md:ml-[220px] pb-20 md:pb-0 min-h-screen">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
          <div className="mb-6">
            <h1 className="font-syne font-extrabold text-2xl text-go-dark mb-1">🔥 Videos Virales</h1>
            <p className="font-dm text-sm text-gray-500">Los videos que más están funcionando en TikTok GO.</p>
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

          {/* List */}
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
                <a
                  key={v.id}
                  href={v.tiktok_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`bg-white rounded-2xl border overflow-hidden flex items-center gap-4 px-5 py-4 transition hover:shadow-sm group ${
                    idx === 0 ? 'border-go-orange/40' : idx === 1 ? 'border-go-peach/40' : idx === 2 ? 'border-go-pink/40' : 'border-go-border'
                  }`}
                >
                  {/* Rank */}
                  <span className={`font-syne font-extrabold text-2xl shrink-0 w-10 text-center ${
                    idx === 0 ? 'text-go-orange' : idx === 1 ? 'text-go-peach' : idx === 2 ? 'text-go-pink' : 'text-gray-300'
                  }`}>
                    #{idx + 1}
                  </span>

                  {/* CTA */}
                  <span className="flex-1 font-dm text-sm font-semibold text-go-orange group-hover:text-go-orange/80 transition">
                    Ver en TikTok →
                  </span>
                </a>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
