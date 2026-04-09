import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Sidebar from '@/components/Sidebar'
import POIsClient from './POIsClient'
import type { Creator, POI } from '@/lib/types'

export default async function POIsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: creator } = await supabase
    .from('go_creators')
    .select('*')
    .eq('email', user.email!)
    .single<Creator>()
  if (!creator) redirect('/')

  const admin = createAdminClient()
  const { data: pois } = await admin.from('go_pois').select('*').eq('is_active', true).order('name')
  const allPois = (pois ?? []) as POI[]

  return (
    <div className="min-h-screen bg-go-light">
      <Sidebar creatorName={creator.full_name} tiktokHandle={creator.tiktok_handle} nivel={creator.nivel} />
      <img src="https://mmhsulgcowhqimypglul.supabase.co/storage/v1/object/public/PGLOGOS/PapayaGo-Sun-Orange-39.png" alt="" className="fixed top-4 right-4 w-40 h-40 opacity-[0.04] pointer-events-none select-none z-0" aria-hidden="true" />
      <main className="md:ml-[220px] pb-20 md:pb-0 min-h-screen">
        <div className="p-4 md:p-8 max-w-5xl mx-auto">
          <div className="mb-6">
            <h1 className="font-syne font-bold text-2xl text-go-dark">📍 Hoteles & Atracciones</h1>
            <p className="font-dm text-sm text-gray-400 mt-1">Explora los lugares disponibles para crear contenido</p>
          </div>
          <POIsClient pois={allPois} creatorNivel={creator.nivel} creatorId={creator.id} creatorName={creator.full_name} tiktokHandle={creator.tiktok_handle} />
        </div>
      </main>
    </div>
  )
}
