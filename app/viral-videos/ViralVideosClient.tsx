'use client'

import Link from 'next/link'

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
  activeType: string
}

export default function ViralVideosClient({ videos, activeType }: Props) {
  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <Link
          href="/viral-videos?type=ACC"
          className={`font-dm text-sm font-semibold px-5 py-2.5 rounded-full border transition ${
            activeType === 'ACC'
              ? 'bg-[#ff7700] text-white border-[#ff7700]'
              : 'bg-white text-gray-600 border-[rgba(255,119,0,0.3)] hover:border-[#ff7700] hover:text-[#ff7700]'
          }`}
        >
          🏨 Hoteles
        </Link>
        <Link
          href="/viral-videos?type=TTD"
          className={`font-dm text-sm font-semibold px-5 py-2.5 rounded-full border transition ${
            activeType === 'TTD'
              ? 'bg-[#ff9ece] text-white border-[#ff9ece]'
              : 'bg-white text-gray-600 border-[rgba(255,119,0,0.3)] hover:border-[#ff9ece] hover:text-[#ff9ece]'
          }`}
        >
          🎡 Atracciones
        </Link>
      </div>

      {/* Grid */}
      {videos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[rgba(255,119,0,0.1)] p-12 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://mmhsulgcowhqimypglul.supabase.co/storage/v1/object/public/PGLOGOS/PapayaGo-Sun-Orange-39.png"
            alt=""
            className="w-16 h-16 mx-auto mb-4 opacity-30"
          />
          <p className="font-dm text-sm text-gray-400">
            Pronto aparecerán los videos más virales
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {videos.map((v, idx) => (
            <a
              key={v.id}
              href={v.tiktok_url}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white rounded-2xl overflow-hidden border border-[rgba(255,119,0,0.1)] hover:shadow-md transition-shadow group"
            >
              {/* Thumbnail */}
              <div className="relative aspect-video bg-gray-100 overflow-hidden">
                {v.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={v.thumbnail_url}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#fff8f2] to-[#ffe8d0] flex items-center justify-center">
                    <svg className="w-12 h-12 text-[#ff7700]/30" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                )}

                {/* Rank badge */}
                <div className="absolute top-3 left-3 w-8 h-8 rounded-full bg-[#ff7700] flex items-center justify-center shadow-lg">
                  <span className="font-syne font-bold text-xs text-white">#{idx + 1}</span>
                </div>

                {/* Play button overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                  <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                    <svg className="w-5 h-5 text-[#1a0800] ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Info bar */}
              <div className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  {v.tiktok_handle && (
                    <span className="font-dm text-sm font-semibold text-[#1a0800] truncate">
                      @{v.tiktok_handle.replace(/^@/, '')}
                    </span>
                  )}
                  {v.views && (
                    <span className="font-dm text-xs text-gray-400 shrink-0">
                      👁 {v.views}
                    </span>
                  )}
                </div>
                <span className={`font-dm text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${
                  v.video_type === 'ACC' ? 'bg-[#ff7700]/10 text-[#ff7700]' : 'bg-[#ff9ece]/20 text-pink-700'
                }`}>
                  {v.video_type}
                </span>
              </div>

              {/* CTA */}
              <div className="px-4 pb-4">
                <span className="block text-center py-2.5 rounded-xl font-dm text-sm font-semibold text-white bg-[#ff7700] group-hover:bg-[#ff7700]/90 transition">
                  Ver en TikTok →
                </span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
