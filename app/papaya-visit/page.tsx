import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Sidebar from '@/components/Sidebar'
import PapayaVisitClient from './PapayaVisitClient'
import type { Creator, POI } from '@/lib/types'

export default async function PapayaVisitPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')
  const { data: creator } = await supabase.from('go_creators').select('*').eq('email', user.email!).single<Creator>()
  if (!creator) redirect('/')

  const admin = createAdminClient()
  const { data: pois } = await admin.from('go_pois').select('*').eq('is_active', true).or('poi_category.eq.papaya_visit,papaya_visited.eq.true').order('name')

  return (
    <div className="min-h-screen bg-[#fff8f2]">
      <Sidebar creatorName={creator.full_name} tiktokHandle={creator.tiktok_handle} nivel={creator.nivel} />
      <main className="md:ml-[220px] pb-20 md:pb-0 min-h-screen">
        <div className="p-4 md:p-8 max-w-5xl mx-auto">
          <div className="mb-6">
            <h1 className="font-syne font-bold text-2xl text-[#1a0800]">🌺 Papaya Visit</h1>
            <p className="font-dm text-sm text-gray-400 mt-1">Lugares donde Papaya tiene deals especiales para ti</p>
          </div>
          <PapayaVisitClient pois={(pois ?? []) as POI[]} creatorNivel={creator.nivel} creatorId={creator.id} creatorName={creator.full_name} tiktokHandle={creator.tiktok_handle} />
        </div>
      </main>
    </div>
  )
}
