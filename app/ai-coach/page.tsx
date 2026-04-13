import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Sidebar from '@/components/Sidebar'
import type { CapCutTemplate } from '@/lib/types'
import PromptCards from './PromptCards'

export default async function AICoachPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: creator } = await supabase.from('go_creators').select('*').eq('email', user.email!).single()
  if (!creator) redirect('/')

  const admin = createAdminClient()
  const { data: templates } = await admin.from('go_capcut_templates').select('*').eq('is_active', true).lte('min_nivel', creator.nivel).order('created_at')
  const allTemplates = (templates ?? []) as CapCutTemplate[]

  return (
    <div className="min-h-screen bg-[#fff8f2]">
      <Sidebar creatorName={creator.full_name} tiktokHandle={creator.tiktok_handle} nivel={creator.nivel} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="https://mmhsulgcowhqimypglul.supabase.co/storage/v1/object/public/PGLOGOS/PapayaGo-Sun-Orange-39.png" alt="" className="fixed top-4 right-4 w-40 h-40 opacity-[0.04] pointer-events-none select-none z-0" aria-hidden="true" />

      <main className="md:ml-[220px] pb-20 md:pb-0 min-h-screen">
        <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">

          <div>
            <h1 className="font-syne font-bold text-2xl text-[#1a0800]">🎬 Crea tu Video</h1>
            <p className="font-dm text-sm text-gray-400 mt-1">Todo lo que necesitas para crear contenido viral</p>
          </div>

          {/* Section 1: GPT Viral Coach */}
          <div className="rounded-2xl overflow-hidden relative" style={{ background: 'linear-gradient(135deg, #fff8f2 0%, #ffe8d0 100%)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://mmhsulgcowhqimypglul.supabase.co/storage/v1/object/public/PGLOGOS/PapayaGo-Sun-lightOrange.png"
              alt=""
              className="absolute right-3 top-1/2 -translate-y-1/2 w-32 h-32 opacity-[0.15] pointer-events-none select-none"
              aria-hidden="true"
            />
            <div className="p-6 md:p-8 relative z-10">
              <h2 className="font-syne font-bold text-xl text-[#1a0800] mb-1">🤖 Papaya GO Viral Coach</h2>
              <p className="font-dm text-sm text-gray-500 mb-5 max-w-md">
                Chatea con nuestra IA entrenada con videos virales reales de TikTok GO. Pídele hooks, captions, voiceovers, ideas — lo que necesites.
              </p>
              <a
                href="https://chatgpt.com/g/g-69dd64b134d48191aa96bec485de4cf5-papaya-go-viral-coach"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block font-dm text-sm font-semibold text-white bg-[#ff7700] hover:bg-[#ff7700]/90 px-8 py-3.5 rounded-xl transition shadow-sm"
              >
                Abrir Viral Coach →
              </a>
              <p className="font-dm text-[11px] text-gray-400 mt-3">Powered by ChatGPT — entrenado por Papaya GO 🧡</p>
            </div>
          </div>

          {/* Section 2: Quick prompts to copy */}
          <div>
            <h2 className="font-syne font-bold text-base border-l-[3px] border-[#ff7700] pl-3 text-[#1a0800] mb-4">
              💡 Prompts rápidos para copiar
            </h2>
            <p className="font-dm text-xs text-gray-400 mb-4">Copia estos prompts y pégalos en el Viral Coach para resultados inmediatos</p>
            <PromptCards />
          </div>

          {/* Section 3: Templates */}
          {allTemplates.length > 0 && (
            <div>
              <h2 className="font-syne font-bold text-base border-l-[3px] border-[#ff7700] pl-3 text-[#1a0800] mb-4">
                🎬 Templates
              </h2>
              <p className="font-dm text-xs text-gray-400 mb-4">Templates de CapCut y Canva para tus videos</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {allTemplates.map(t => (
                  <div key={t.id} className="bg-white border border-[rgba(255,119,0,0.1)] rounded-2xl p-5">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-syne font-bold text-sm text-[#1a0800]">{t.title}</h3>
                      <span className={`font-dm text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${t.video_type === 'ACC' ? 'bg-blue-100 text-blue-700' : t.video_type === 'TTD' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                        {t.video_type}
                      </span>
                    </div>
                    {t.description && <p className="font-dm text-xs text-gray-500 mb-3">{t.description}</p>}
                    <a href={t.url} target="_blank" rel="noopener noreferrer" className="font-dm text-sm font-semibold text-[#ff7700] hover:underline">
                      Abrir template →
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  )
}
