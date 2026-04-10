'use client'

import { useState, useTransition } from 'react'
import { submitBoost } from '@/app/boost/actions'

export default function DashboardClient({ creatorId, creatorName, tiktokHandle }: { creatorId: string; creatorName: string | null; tiktokHandle: string | null }) {
  const [url, setUrl] = useState('')
  const [sent, setSent] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit() {
    if (!url.trim()) return
    startTransition(async () => {
      await submitBoost({ creator_id: creatorId, creator_name: creatorName, tiktok_handle: tiktokHandle, tiktok_url: url.trim(), boost_reason: null, notes: null })
      setSent(true)
      setUrl('')
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
        <div className="flex gap-2">
          <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://www.tiktok.com/@..." className="flex-1 px-4 py-2.5 rounded-xl border border-orange-200 font-dm text-sm focus:outline-none focus:ring-2 focus:ring-[#ff7700]/30 focus:border-[#ff7700] transition" />
          <button onClick={handleSubmit} disabled={isPending || !url.trim()} className="font-dm text-sm font-semibold text-white bg-[#ff7700] hover:bg-[#ff7700]/90 px-4 py-2.5 rounded-xl transition disabled:opacity-50">
            {isPending ? '...' : 'Enviar 🚀'}
          </button>
        </div>
      )}
    </div>
  )
}
