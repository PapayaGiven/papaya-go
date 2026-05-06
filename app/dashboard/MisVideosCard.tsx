'use client'

import { useState } from 'react'

interface Video {
  id: string
  tiktok_url: string
  video_type: 'ACC' | 'TTD' | null
  status: string
  is_valid: boolean
  boost_status: 'pending' | 'boosteado' | 'rechazado'
  rejection_reason: string | null
  created_at: string
}

type Filter = 'all' | 'ACC' | 'TTD' | 'approved' | 'pending'

function truncate(url: string, max = 36) {
  return url.length > max ? url.slice(0, max) + '...' : url
}

function validBadge(isValid: boolean, boostStatus: string) {
  if (isValid) return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">✅ Video válido</span>
  if (boostStatus === 'rechazado') return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">❌ Inválido</span>
  return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">⏳ En revisión</span>
}

function boostBadge(boostStatus: string) {
  if (boostStatus === 'boosteado') return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">🚀 Siendo boosteado</span>
  if (boostStatus === 'rechazado') return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">✗ Sin boost</span>
  return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">⏳ Boost pendiente</span>
}

function typeBadge(type: 'ACC' | 'TTD' | null) {
  if (type === 'ACC') return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">ACC</span>
  if (type === 'TTD') return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-100 text-pink-700">TTD</span>
  return null
}

export default function MisVideosCard({ videos, approved, pending }: { videos: Video[]; approved: number; pending: number }) {
  const [filter, setFilter] = useState<Filter>('all')

  const filtered = videos.filter((v) => {
    if (filter === 'all') return true
    if (filter === 'ACC' || filter === 'TTD') return v.video_type === filter
    if (filter === 'approved') return v.is_valid === true
    if (filter === 'pending') return v.is_valid !== true
    return true
  })

  return (
    <div className="bg-white border border-[rgba(255,119,0,0.12)] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h2 className="font-syne font-bold text-base text-[#1a0800]">🎬 Mis Videos este mes</h2>
        <p className="font-dm text-xs text-gray-500">{videos.length} videos ({approved} aprobados · {pending} pendientes)</p>
      </div>

      <div className="flex gap-1.5 mt-3 mb-4 flex-wrap">
        {([
          ['all', 'Todos'],
          ['ACC', 'ACC'],
          ['TTD', 'TTD'],
          ['approved', 'Aprobados'],
          ['pending', 'Pendientes'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`text-xs font-semibold px-3 py-1 rounded-full font-dm transition ${
              filter === key ? 'bg-go-orange text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {videos.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-5xl mb-2">☀️</div>
          <p className="font-dm text-sm text-gray-500 mb-4">Aún no has enviado videos este mes. ¡Empieza hoy! 🎬</p>
          <a href="/boost" className="inline-block bg-go-orange text-white font-dm font-semibold text-xs px-4 py-2 rounded-xl hover:bg-go-orange/90 transition">
            Subir mi primer video →
          </a>
        </div>
      ) : filtered.length === 0 ? (
        <p className="font-dm text-sm text-gray-400 text-center py-6">Ningún video coincide con este filtro.</p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((v) => (
            <li key={v.id} className="bg-go-light/50 border border-go-border/50 rounded-xl px-3 py-2">
              <div className="flex items-center gap-2 flex-wrap">
                {typeBadge(v.video_type)}
                <a href={v.tiktok_url} target="_blank" rel="noopener noreferrer" className="text-xs text-go-orange hover:underline truncate flex-1 min-w-0 font-dm">
                  {truncate(v.tiktok_url)}
                </a>
                <span className="text-[10px] text-gray-400 font-dm shrink-0">
                  {new Date(v.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                {validBadge(v.is_valid, v.boost_status)}
                {boostBadge(v.boost_status)}
              </div>
              {v.boost_status === 'rechazado' && v.rejection_reason && (
                <p className="font-dm text-[11px] text-red-600 mt-1">Razón: {v.rejection_reason}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
