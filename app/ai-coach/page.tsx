import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import type { POI, CapCutTemplate } from '@/lib/types'
import AICoachClient from './AICoachClient'

export default async function AICoachPage({
  searchParams,
}: {
  searchParams: { poi?: string }
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: creator } = await supabase
    .from('go_creators')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!creator) redirect('/')
  if (creator.status === 'pending') redirect('/pending')

  const { data: pois } = await supabase
    .from('go_pois')
    .select('*')
    .eq('is_active', true)
    .lte('min_nivel', creator.nivel)
    .order('name')

  const { data: templates } = await supabase
    .from('go_capcut_templates')
    .select('*')
    .lte('min_nivel', creator.nivel)
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-go-light">
      <Sidebar
        creatorName={creator.full_name}
        tiktokHandle={creator.tiktok_handle}
        nivel={creator.nivel}
      />
      <main className="md:ml-[220px] pb-24 md:pb-8">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="font-syne font-extrabold text-2xl text-go-dark">
              AI Coach
            </h1>
            <p className="font-dm text-sm text-gray-500 mt-1">
              Genera hooks, captions, voiceovers e ideas para tus videos de TikTok GO.
            </p>
          </div>

          <AICoachClient
            pois={(pois as POI[]) ?? []}
            templates={(templates as CapCutTemplate[]) ?? []}
            preselectedPoiId={searchParams.poi ?? null}
          />
        </div>
      </main>
    </div>
  )
}
