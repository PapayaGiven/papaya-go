import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import BoostClient from './BoostClient'
import type { Creator, BoostRequest } from '@/lib/types'

export default async function BoostPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: creator } = await supabase.from('go_creators').select('*').eq('email', user.email!).single<Creator>()
  if (!creator) redirect('/')

  const { data: pastRequests } = await supabase
    .from('go_boost_requests')
    .select('*')
    .eq('creator_id', creator.id)
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-go-light">
      <Sidebar creatorName={creator.full_name} tiktokHandle={creator.tiktok_handle} nivel={creator.nivel} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="https://mmhsulgcowhqimypglul.supabase.co/storage/v1/object/public/PGLOGOS/PapayaGo-Sun-Orange-39.png" alt="" className="fixed top-4 right-4 w-40 h-40 opacity-[0.04] pointer-events-none select-none z-0" aria-hidden="true" />
      <main className="md:ml-[220px] pb-20 md:pb-0 min-h-screen">
        <div className="p-4 md:p-8 max-w-3xl mx-auto">
          <div className="mb-6">
            <h1 className="font-syne font-bold text-2xl text-go-dark">🚀 Boost tu Video</h1>
            <p className="font-dm text-sm text-gray-400 mt-1">Sube tu video y Papaya lo impulsa en la comunidad</p>
          </div>
          <BoostClient
            creatorId={creator.id}
            creatorName={creator.full_name}
            tiktokHandle={creator.tiktok_handle}
            pastRequests={(pastRequests ?? []) as BoostRequest[]}
          />
        </div>
      </main>
    </div>
  )
}
