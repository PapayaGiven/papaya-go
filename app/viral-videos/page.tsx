import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import ViralVideosClient from './ViralVideosClient'

interface ViralVideo {
  id: string
  tiktok_url: string
  tiktok_handle: string | null
  views: string | null
  video_type: string | null
  is_active: boolean
  thumbnail_url?: string
}

async function fetchThumbnail(tiktokUrl: string): Promise<string | null> {
  try {
    const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(tiktokUrl)}`, {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(5000)
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.thumbnail_url || null
  } catch {
    return null
  }
}

export default async function ViralVideosPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: creatorData } = await supabase.from('go_creators').select('*').eq('email', user.email!).single()
  if (!creatorData) redirect('/')

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

  // Fetch thumbnails in parallel (limit to first 20)
  const withThumbnails = await Promise.all(
    items.slice(0, 20).map(async (v) => ({
      ...v,
      thumbnail_url: await fetchThumbnail(v.tiktok_url) ?? undefined,
    }))
  )

  return (
    <div className="min-h-screen bg-[#fff8f2]">
      <Sidebar creatorName={creatorData.full_name} tiktokHandle={creatorData.tiktok_handle} nivel={creatorData.nivel} />
      <main className="md:ml-[220px] pb-20 md:pb-0 min-h-screen">
        <div className="p-4 md:p-8 max-w-5xl mx-auto">
          <div className="mb-6">
            <h1 className="font-syne font-bold text-2xl text-[#1a0800]">🔥 Videos Virales</h1>
            <p className="font-dm text-sm text-gray-400 mt-1">Los videos que más están funcionando en TikTok GO</p>
          </div>
          <ViralVideosClient videos={withThumbnails} activeType={activeType} />
        </div>
      </main>
    </div>
  )
}
