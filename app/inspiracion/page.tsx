import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Sidebar from '@/components/Sidebar'
import InspiracionClient from './InspiracionClient'
import type { Creator, POI } from '@/lib/types'

interface ViralVideo {
  id: string
  tiktok_url: string
  tiktok_handle: string | null
  views: string | null
  video_type: string | null
  is_active: boolean
  thumbnail_url?: string
}

async function fetchThumbnail(url: string): Promise<string | null> {
  try {
    const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(5000) })
    if (!res.ok) return null
    const data = await res.json()
    return data.thumbnail_url || null
  } catch { return null }
}

export default async function InspiracionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')
  const { data: creator } = await supabase.from('go_creators').select('*').eq('email', user.email!).single<Creator>()
  if (!creator) redirect('/')

  const admin = createAdminClient()
  const [videosRes, poisRes] = await Promise.all([
    admin.from('go_viral_videos').select('*').eq('is_active', true).order('created_at'),
    admin.from('go_pois').select('*').eq('is_active', true).or('poi_category.eq.viral,is_viral_poi.eq.true').order('times_sold', { ascending: false }),
  ])

  const videos = (videosRes.data ?? []) as ViralVideo[]
  const withThumbs = await Promise.all(videos.slice(0, 20).map(async v => ({ ...v, thumbnail_url: await fetchThumbnail(v.tiktok_url) ?? undefined })))
  const viralPois = (poisRes.data ?? []) as POI[]

  return (
    <div className="min-h-screen bg-[#fff8f2]">
      <Sidebar creatorName={creator.full_name} tiktokHandle={creator.tiktok_handle} nivel={creator.nivel} />
      <main className="md:ml-[220px] pb-20 md:pb-0 min-h-screen">
        <div className="p-4 md:p-8 max-w-5xl mx-auto">
          <div className="mb-6">
            <h1 className="font-syne font-bold text-2xl text-[#1a0800]">🔥 Inspiración</h1>
            <p className="font-dm text-sm text-gray-400 mt-1">Videos virales y lugares que más convierten</p>
          </div>
          <InspiracionClient videos={withThumbs} viralPois={viralPois} />
        </div>
      </main>
    </div>
  )
}
