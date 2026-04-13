import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import AICoachClient from './AICoachClient'

export default async function AICoachPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: creator } = await supabase
    .from('go_creators')
    .select('*')
    .eq('email', user.email!)
    .single()

  if (!creator) redirect('/')

  return (
    <div className="min-h-screen bg-go-light">
      <Sidebar creatorName={creator.full_name} tiktokHandle={creator.tiktok_handle} nivel={creator.nivel} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="https://mmhsulgcowhqimypglul.supabase.co/storage/v1/object/public/PGLOGOS/PapayaGo-Sun-Orange-39.png" alt="" className="fixed top-4 right-4 w-40 h-40 opacity-[0.04] pointer-events-none select-none z-0" aria-hidden="true" />
      <main className="md:ml-[220px] pb-20 md:pb-0 min-h-screen">
        <div className="p-4 md:p-8 max-w-3xl mx-auto">
          <div className="mb-6">
            <h1 className="font-syne font-bold text-2xl text-go-dark">✨ Crea tu Video</h1>
            <p className="font-dm text-sm text-gray-400 mt-1">Genera hooks, captions y voiceovers con AI</p>
          </div>

          {/* GPT Viral Coach Banner */}
          <div className="rounded-2xl overflow-hidden relative mb-6" style={{ background: 'linear-gradient(135deg, #fff8f2 0%, #ffe8d0 100%)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://mmhsulgcowhqimypglul.supabase.co/storage/v1/object/public/PGLOGOS/PapayaGo-Sun-lightOrange.png"
              alt=""
              className="absolute right-3 top-1/2 -translate-y-1/2 w-28 h-28 opacity-[0.15] pointer-events-none select-none"
              aria-hidden="true"
            />
            <div className="p-5 md:p-6 relative z-10">
              <h2 className="font-syne font-bold text-lg text-[#1a0800] mb-1">🤖 Papaya GO Viral Coach</h2>
              <p className="font-dm text-sm text-gray-500 mb-4 max-w-md">
                Chatea con nuestra IA entrenada con videos virales reales de TikTok GO
              </p>
              <a
                href="https://chatgpt.com/g/g-69dd64b134d48191aa96bec485de4cf5-papaya-go-viral-coach"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block font-dm text-sm font-semibold text-white bg-[#ff7700] hover:bg-[#ff7700]/90 px-6 py-3 rounded-xl transition"
              >
                Abrir Viral Coach →
              </a>
              <p className="font-dm text-[11px] text-gray-400 mt-2">Powered by ChatGPT — entrenado por Papaya GO 🧡</p>
            </div>
          </div>

          <AICoachClient />
        </div>
      </main>
    </div>
  )
}
