import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import Link from 'next/link'

interface ViralVideo {
  id: string
  tiktok_url: string
  creator_name: string | null
  views: string | null
  poi_name: string | null
  video_type: string | null
  notes: string | null
  is_active: boolean
  created_at: string
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

  const query = admin
    .from('go_viral_videos')
    .select('*')
    .eq('is_active', true)
    .eq('video_type', activeType)
    .order('created_at', { ascending: false })

  const { data: videos } = await query
  const items = (videos ?? []) as ViralVideo[]

  return (
    <div className="min-h-screen bg-go-light">
      <Sidebar creatorName={creatorData.full_name} tiktokHandle={creatorData.tiktok_handle} nivel={creatorData.nivel} />
      <main className="md:ml-[220px] pb-20 md:pb-0 min-h-screen">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          <div className="mb-6">
            <h1 className="font-syne font-extrabold text-2xl text-go-dark mb-1">🔥 Videos Virales</h1>
            <p className="font-dm text-sm text-gray-500">Inspírate con los videos que más están funcionando en TikTok GO.</p>
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

          {/* Grid */}
          {items.length === 0 ? (
            <div className="bg-white rounded-2xl border border-go-border p-10 text-center">
              <p className="text-4xl mb-3">🎬</p>
              <p className="font-dm text-gray-500 text-sm">
                Aún no hay videos de {activeType === 'ACC' ? 'hoteles' : 'atracciones'}. ¡Pronto se agregarán!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((v) => (
                <div key={v.id} className="bg-white rounded-2xl border border-go-border overflow-hidden flex flex-col">
                  {/* Thumbnail / video link */}
                  <a
                    href={v.tiktok_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block bg-gradient-to-br from-go-light to-go-peach/20 p-6 text-center group hover:from-go-orange/5 transition"
                  >
                    <div className="w-14 h-14 rounded-full bg-go-orange/10 flex items-center justify-center mx-auto mb-2 group-hover:bg-go-orange/20 transition">
                      <svg className="w-6 h-6 text-go-orange ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                    <p className="font-dm text-xs text-go-orange font-semibold">Ver en TikTok →</p>
                  </a>

                  {/* Info */}
                  <div className="p-4 flex-1 flex flex-col">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      {v.creator_name && (
                        <span className="font-dm text-sm font-semibold text-go-dark">{v.creator_name}</span>
                      )}
                      {v.views && (
                        <span className="font-dm text-xs font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{v.views} views</span>
                      )}
                      <span className={`font-dm text-xs font-bold px-2 py-0.5 rounded-full ${
                        v.video_type === 'ACC' ? 'bg-go-orange/10 text-go-orange' : 'bg-go-pink/20 text-pink-700'
                      }`}>
                        {v.video_type}
                      </span>
                    </div>

                    {v.poi_name && (
                      <p className="font-dm text-xs text-gray-500 mb-2">📍 {v.poi_name}</p>
                    )}

                    {v.notes && (
                      <div className="mt-auto pt-3 border-t border-go-border">
                        <p className="font-dm text-xs font-semibold text-gray-400 uppercase tracking-widest mb-1">¿Por qué funciona?</p>
                        <p className="font-dm text-xs text-gray-600 leading-relaxed">{v.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
