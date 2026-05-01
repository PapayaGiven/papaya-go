'use client'

import { useState, useTransition } from 'react'
import { submitBoost } from '@/app/boost/actions'

export default function DashboardClient({ creatorId, creatorName, tiktokHandle }: { creatorId: string; creatorName: string | null; tiktokHandle: string | null }) {
  const [url, setUrl] = useState('')
  const [videoType, setVideoType] = useState<'ACC' | 'TTD' | null>(null)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit() {
    setError('')
    if (!url.trim()) return
    if (!videoType) { setError('Selecciona ACC o TTD'); return }
    startTransition(async () => {
      await submitBoost({ creator_id: creatorId, creator_name: creatorName, tiktok_handle: tiktokHandle, tiktok_url: url.trim(), boost_reason: null, notes: null, video_type: videoType })
      setSent(true)
      setUrl('')
      setVideoType(null)
      setTimeout(() => setSent(false), 3000)
    })
  }

  return (
    <div className="bg-white border border-[rgba(255,119,0,0.12)] rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">🚀</span>
        <h2 className="font-syne font-bold text-base text-[#1a0800]">Boost rápido</h2>
      </div>
      <p className="font-dm text-xs text-gray-400 mb-3">¿Tienes un video listo? Mándanoslo para boostearlo</p>
      {sent ? (
        <p className="font-dm text-sm text-[#ff7700] font-semibold">¡Video enviado! Te avisamos pronto 🧡</p>
      ) : (
        <div className="space-y-2">
          <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://www.tiktok.com/@..." className="w-full px-4 py-2.5 rounded-xl border border-orange-200 font-dm text-sm focus:outline-none focus:ring-2 focus:ring-[#ff7700]/30 focus:border-[#ff7700] transition" />
          <div className="flex gap-2">
            {(['ACC', 'TTD'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setVideoType(t)}
                className={`flex-1 py-2 rounded-xl font-dm font-semibold text-xs transition border-2 ${
                  videoType === t
                    ? 'bg-[#ff7700] text-white border-[#ff7700]'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-[#ff7700]/40'
                }`}
              >
                {t}
              </button>
            ))}
            <button onClick={handleSubmit} disabled={isPending || !url.trim() || !videoType} className="font-dm text-xs font-semibold text-white bg-[#ff7700] hover:bg-[#ff7700]/90 px-4 py-2 rounded-xl transition disabled:opacity-50">
              {isPending ? '...' : 'Enviar 🚀'}
            </button>
          </div>
          {error && <p className="font-dm text-xs text-red-500">{error}</p>}
        </div>
      )}
    </div>
  )
}
