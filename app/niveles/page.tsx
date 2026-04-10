import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Sidebar from '@/components/Sidebar'
import NivelesClient from './NivelesClient'
import type { Creator, NivelRequirement, NivelReward, RewardRequest } from '@/lib/types'

export default async function NivelesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: creator } = await supabase.from('go_creators').select('*').eq('email', user.email!).single<Creator>()
  if (!creator) redirect('/')

  const admin = createAdminClient()
  const [reqsRes, rewardsRes, myRequestsRes] = await Promise.all([
    admin.from('go_nivel_requirements').select('*').order('nivel'),
    admin.from('go_nivel_rewards').select('*').eq('is_active', true).order('nivel'),
    supabase.from('go_reward_requests').select('*').eq('creator_id', creator.id),
  ])

  return (
    <div className="min-h-screen bg-go-light">
      <Sidebar creatorName={creator.full_name} tiktokHandle={creator.tiktok_handle} nivel={creator.nivel} />
      <img src="https://mmhsulgcowhqimypglul.supabase.co/storage/v1/object/public/PGLOGOS/PapayaGo-Sun-Orange-39.png" alt="" className="fixed top-4 right-4 w-40 h-40 opacity-[0.04] pointer-events-none select-none z-0" aria-hidden="true" />
      <main className="md:ml-[220px] pb-20 md:pb-0 min-h-screen">
        <div className="p-4 md:p-8 max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="font-syne font-bold text-2xl text-go-dark">⭐ Niveles</h1>
            <p className="font-dm text-sm text-gray-400 mt-1">Tu camino como creadora en Papaya GO</p>
          </div>
          <NivelesClient
            creator={creator}
            requirements={(reqsRes.data ?? []) as NivelRequirement[]}
            rewards={(rewardsRes.data ?? []) as NivelReward[]}
            myRequests={(myRequestsRes.data ?? []) as RewardRequest[]}
          />
          <div className="bg-white border border-[rgba(255,119,0,0.12)] rounded-2xl p-4 flex items-center gap-3 mt-6">
            <span className="text-lg">💬</span>
            <p className="font-dm text-xs text-gray-500 flex-1">¿Preguntas sobre tus rewards? Escríbenos en WhatsApp</p>
            <a href="https://chat.whatsapp.com/IKy0BMc8ROl55Hm4r47C2Z?mode=gi_t" target="_blank" rel="noopener noreferrer" className="font-dm text-xs font-semibold text-white bg-[#25D366] hover:bg-[#20BD5A] px-4 py-2 rounded-xl transition shrink-0">
              WhatsApp →
            </a>
          </div>
        </div>
      </main>
    </div>
  )
}
