'use client'

import { useEffect, useState } from 'react'

interface OEmbed {
  title?: string
  thumbnail_url?: string
  author_name?: string
  author_url?: string
}

export function PreviewButton({ url, onOpen }: { url: string | null; onOpen: () => void }) {
  if (!url) return null
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onOpen() }}
      className="text-[10px] font-semibold text-go-dark/70 bg-go-dark/[0.05] hover:bg-go-dark/[0.1] px-2 py-0.5 rounded-md"
      title="Vista previa"
    >👁️ Ver</button>
  )
}

export default function TikTokPreviewModal({ url, onClose }: { url: string | null; onClose: () => void }) {
  const [data, setData] = useState<OEmbed | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!url) return
    setLoading(true)
    setData(null)
    setError(null)
    // TikTok's oEmbed endpoint is CORS-open; safe to fetch from the browser.
    fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(8000) })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((d) => setData(d as OEmbed))
      .catch(() => setError('No se pudo cargar la vista previa'))
      .finally(() => setLoading(false))
  }, [url])

  if (!url) return null

  return (
    <div className="fixed inset-0 z-[180] bg-black/60 flex items-center justify-center px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="font-syne font-bold text-base text-go-dark">Vista previa</h3>
          <button onClick={onClose} className="text-go-dark/40 hover:text-go-dark text-lg leading-none">×</button>
        </div>
        {loading && <p className="font-dm text-sm text-go-dark/60 text-center py-8">Cargando…</p>}
        {error && <p className="font-dm text-sm text-red-600 text-center py-8">{error}</p>}
        {data && (
          <div className="space-y-3">
            {data.thumbnail_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.thumbnail_url} alt={data.title ?? 'TikTok'} className="w-full rounded-xl border border-go-border" />
            )}
            {data.title && <p className="font-dm text-sm text-go-dark">{data.title}</p>}
            {data.author_name && (
              <p className="font-dm text-xs text-go-dark/60">por <strong>{data.author_name}</strong></p>
            )}
          </div>
        )}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full mt-4 text-center bg-go-orange text-white font-dm font-semibold text-sm py-2.5 rounded-lg hover:bg-go-orange/90"
        >Abrir en TikTok →</a>
      </div>
    </div>
  )
}
