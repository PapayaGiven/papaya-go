'use client'

import { useState } from 'react'
import Link from 'next/link'
import { POI_TYPE_LABELS } from '@/lib/types'
import type { POI } from '@/lib/types'

interface ViralVideo {
  id: string
  tiktok_url: string
  tiktok_handle: string | null
  views: string | null
  video_type: string | null
  thumbnail_url?: string
}

interface Props {
  videos: ViralVideo[]
  viralPois: POI[]
}

export default function InspiracionClient({ videos, viralPois }: Props) {
  const [mainTab, setMainTab] = useState<'videos' | 'places'>('videos')
  const [videoType, setVideoType] = useState<'ACC' | 'TTD'>('ACC')

  const filteredVideos = videos.filter(v => v.video_type === videoType)

  return (
    <div>
      {/* Main tabs */}
      <div className="flex gap-2 mb-6">
        <button onClick={() => setMainTab('videos')} className={`font-dm text-sm font-semibold px-5 py-2.5 rounded-full border transition ${mainTab === 'videos' ? 'bg-[#ff7700] text-white border-[#ff7700]' : 'bg-white text-gray-600 border-[rgba(255,119,0,0.3)] hover:border-[#ff7700]'}`}>
          🎬 Videos Virales
        </button>
        <button onClick={() => setMainTab('places')} className={`font-dm text-sm font-semibold px-5 py-2.5 rounded-full border transition ${mainTab === 'places' ? 'bg-[#ff7700] text-white border-[#ff7700]' : 'bg-white text-gray-600 border-[rgba(255,119,0,0.3)] hover:border-[#ff7700]'}`}>
          🔥 Lugares que convierten
        </button>
      </div>

      {/* TAB 1: Videos */}
      {mainTab === 'videos' && (
        <div>
          <div className="flex gap-2 mb-4">
            <button onClick={() => setVideoType('ACC')} className={`font-dm text-xs font-semibold px-4 py-2 rounded-full transition ${videoType === 'ACC' ? 'bg-[#ff7700]/10 text-[#ff7700]' : 'bg-gray-100 text-gray-500'}`}>🏨 Hoteles</button>
            <button onClick={() => setVideoType('TTD')} className={`font-dm text-xs font-semibold px-4 py-2 rounded-full transition ${videoType === 'TTD' ? 'bg-[#ff9ece]/20 text-pink-700' : 'bg-gray-100 text-gray-500'}`}>🎡 Atracciones</button>
          </div>

          {filteredVideos.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[rgba(255,119,0,0.1)] p-12 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="https://mmhsulgcowhqimypglul.supabase.co/storage/v1/object/public/PGLOGOS/PapayaGo-Sun-Orange-39.png" alt="" className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="font-dm text-sm text-gray-400">Pronto aparecerán los videos más virales</p>
              <a href="https://chat.whatsapp.com/IKy0BMc8ROl55Hm4r47C2Z?mode=gi_t" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 font-dm text-xs font-semibold text-white bg-[#25D366] hover:bg-[#20BD5A] px-4 py-2 rounded-xl transition mt-3">
                💬 Únete a nuestra comunidad →
              </a>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredVideos.map((v, idx) => (
                <a key={v.id} href={v.tiktok_url} target="_blank" rel="noopener noreferrer" className="bg-white rounded-2xl overflow-hidden border border-[rgba(255,119,0,0.1)] hover:shadow-md transition-shadow group">
                  <div className="relative aspect-video bg-gray-100 overflow-hidden">
                    {v.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v.thumbnail_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-[#fff8f2] to-[#ffe8d0] flex items-center justify-center">
                        <svg className="w-12 h-12 text-[#ff7700]/30" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                      </div>
                    )}
                    <div className="absolute top-3 left-3 w-8 h-8 rounded-full bg-[#ff7700] flex items-center justify-center shadow-lg">
                      <span className="font-syne font-bold text-xs text-white">#{idx + 1}</span>
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                      <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                        <svg className="w-5 h-5 text-[#1a0800] ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                      </div>
                    </div>
                  </div>
                  <div className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      {v.tiktok_handle && <span className="font-dm text-sm font-semibold text-[#1a0800] truncate">@{v.tiktok_handle.replace(/^@/, '')}</span>}
                      {v.views && <span className="font-dm text-xs text-gray-400 shrink-0">👁 {v.views}</span>}
                    </div>
                    <span className={`font-dm text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${v.video_type === 'ACC' ? 'bg-[#ff7700]/10 text-[#ff7700]' : 'bg-[#ff9ece]/20 text-pink-700'}`}>{v.video_type}</span>
                  </div>
                  <div className="px-4 pb-4">
                    <span className="block text-center py-2.5 rounded-xl font-dm text-sm font-semibold text-white bg-[#ff7700] group-hover:bg-[#ff7700]/90 transition">Ver en TikTok →</span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Places */}
      {mainTab === 'places' && (
        <div>
          {viralPois.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[rgba(255,119,0,0.1)] p-12 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="https://mmhsulgcowhqimypglul.supabase.co/storage/v1/object/public/PGLOGOS/PapayaGo-Sun-Orange-39.png" alt="" className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="font-dm text-sm text-gray-400">Pronto añadiremos los lugares que más convierten 🔥</p>
              <a href="https://chat.whatsapp.com/IKy0BMc8ROl55Hm4r47C2Z?mode=gi_t" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 font-dm text-xs font-semibold text-white bg-[#25D366] hover:bg-[#20BD5A] px-4 py-2 rounded-xl transition mt-3">
                💬 Únete a nuestra comunidad →
              </a>
            </div>
          ) : (
            <div className="space-y-3">
              {viralPois.map((poi, idx) => {
                const typeInfo = POI_TYPE_LABELS[poi.type] ?? { label: poi.type, color: 'bg-gray-100 text-gray-700' }
                return (
                  <div key={poi.id} className="bg-white rounded-2xl border border-[rgba(255,119,0,0.1)] p-4 flex items-center gap-4">
                    <span className={`font-syne font-extrabold text-2xl shrink-0 w-10 text-center ${idx === 0 ? 'text-[#ff7700]' : idx === 1 ? 'text-[#ffa552]' : idx === 2 ? 'text-[#ff9ece]' : 'text-gray-300'}`}>#{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-syne font-bold text-sm text-[#1a0800] truncate">{poi.name}</h3>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`font-dm text-[10px] font-semibold px-2 py-0.5 rounded-full ${typeInfo.color}`}>{typeInfo.label}</span>
                        {poi.commission && <span className="font-dm text-xs font-bold text-[#ff7700]">{poi.commission}</span>}
                        {poi.times_sold > 0 && <span className="font-dm text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#ff7700]/10 text-[#ff7700]">{poi.times_sold} bookings</span>}
                      </div>
                    </div>
                    <Link href={`/ai-coach?place=${encodeURIComponent(poi.name)}`} className="shrink-0 font-dm text-xs font-semibold text-[#ff7700] hover:underline">✨ Crear contenido</Link>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
