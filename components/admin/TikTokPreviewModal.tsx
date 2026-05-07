'use client'

import { useEffect, useState } from 'react'
import { updateBoostRequest } from '@/app/admin/actions'

interface OEmbed {
  title?: string
  thumbnail_url?: string
  author_name?: string
  author_url?: string
}

function isShortTikTokLink(url: string | null | undefined): boolean {
  if (!url) return false
  return /tiktok\.com\/t\//i.test(url) || /vm\.tiktok\.com/i.test(url) || /vt\.tiktok\.com/i.test(url)
}

async function resolveShortLink(url: string): Promise<string | null> {
  try {
    const res = await fetch('/api/resolve-tiktok-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(7000),
    })
    if (!res.ok) return null
    const data = await res.json()
    return typeof data?.resolvedUrl === 'string' ? data.resolvedUrl : null
  } catch {
    return null
  }
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

// boostId: when provided, the modal persists a resolved short link back to
// go_boost_requests so the row no longer carries the unstable shortened form.
export default function TikTokPreviewModal({
  url,
  boostId,
  onClose,
  onResolved,
}: {
  url: string | null
  boostId?: string
  onClose: () => void
  onResolved?: (resolvedUrl: string) => void
}) {
  const [data, setData] = useState<OEmbed | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [effectiveUrl, setEffectiveUrl] = useState<string | null>(null)
  const [resolveNote, setResolveNote] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!url) { setEffectiveUrl(null); return }

    setLoading(true)
    setData(null)
    setError(null)
    setEffectiveUrl(url)
    setResolveNote(null)

    async function run(initial: string) {
      let target = initial
      if (isShortTikTokLink(target)) {
        setResolveNote('🔄 Resolviendo link…')
        const resolved = await resolveShortLink(target)
        if (cancelled) return
        if (resolved) {
          target = resolved
          setEffectiveUrl(resolved)
          setResolveNote('✅ Link resuelto correctamente')
          onResolved?.(resolved)
          // Persist back to DB if we know which row this is.
          if (boostId) {
            updateBoostRequest(boostId, { tiktok_url: resolved }).catch(() => {})
          }
        } else {
          setResolveNote('⚠️ No pudimos resolver este link. Intenta copiar el link desde tu perfil de TikTok.')
        }
      }

      // TikTok's oEmbed endpoint is CORS-open; safe to fetch from the browser.
      try {
        const r = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(target)}`, {
          signal: AbortSignal.timeout(8000),
        })
        if (cancelled) return
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const d = (await r.json()) as OEmbed
        if (cancelled) return
        setData(d)
      } catch {
        if (!cancelled) setError('No se pudo cargar la vista previa')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    run(url)
    return () => { cancelled = true }
  }, [url, boostId, onResolved])

  if (!url) return null

  return (
    <div className="fixed inset-0 z-[180] bg-black/60 flex items-center justify-center px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="font-syne font-bold text-base text-go-dark">Vista previa</h3>
          <button onClick={onClose} className="text-go-dark/40 hover:text-go-dark text-lg leading-none">×</button>
        </div>
        {resolveNote && (
          <p className={`font-dm text-[11px] mb-3 ${resolveNote.startsWith('✅') ? 'text-emerald-700' : resolveNote.startsWith('⚠️') ? 'text-yellow-700' : 'text-go-dark/60'}`}>
            {resolveNote}
          </p>
        )}
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
          href={effectiveUrl ?? url}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full mt-4 text-center bg-go-orange text-white font-dm font-semibold text-sm py-2.5 rounded-lg hover:bg-go-orange/90"
        >Abrir en TikTok →</a>
      </div>
    </div>
  )
}
