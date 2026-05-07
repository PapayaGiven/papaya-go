'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { submitBoostBatch } from './actions'
import type { BoostRequest } from '@/lib/types'

interface BoostClientProps {
  creatorId: string
  creatorName: string | null
  tiktokHandle: string | null
  pastRequests: BoostRequest[]
}

interface Row {
  id: number
  url: string
  type: 'ACC' | 'TTD' | null
  boost: boolean
  error?: string
}

let nextId = 1
function newRow(): Row {
  return { id: nextId++, url: '', type: null, boost: false }
}

// Short links (tiktok.com/t/…, vm.tiktok.com/…, vt.tiktok.com/…) are
// region-bound and frequently die. We don't try to resolve them server-side
// — TikTok blocks bot fetches and returns the homepage — so the only safe
// move is to ask the creator to copy the canonical link.
function isShortTikTokLink(url: string): boolean {
  return /tiktok\.com\/t\//i.test(url) || /vm\.tiktok\.com/i.test(url) || /vt\.tiktok\.com/i.test(url)
}

function statusBadge(status: string) {
  switch (status) {
    case 'boosteado':
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-dm font-medium bg-green-100 text-green-700">✅ Aprobado</span>
    case 'rejected':
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-dm font-medium bg-red-100 text-red-700">❌ Rechazado</span>
    case 'in_progress':
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-dm font-medium bg-orange-100 text-orange-700">🚀 En proceso</span>
    default:
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-dm font-medium bg-gray-100 text-gray-500">⏳ Pendiente</span>
  }
}

function truncateUrl(url: string, max = 40) {
  return url.length > max ? url.slice(0, max) + '...' : url
}

export default function BoostClient({ creatorId, creatorName, tiktokHandle, pastRequests }: BoostClientProps) {
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>([newRow()])
  const [submittedCount, setSubmittedCount] = useState<number | null>(null)
  const [topError, setTopError] = useState('')
  const [loading, setLoading] = useState(false)

  // Running totals from past submissions (this month)
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const thisMonth = pastRequests.filter((r) => r.created_at >= monthStart)
  const accCount = thisMonth.filter((r) => r.video_type === 'ACC').length
  const ttdCount = thisMonth.filter((r) => r.video_type === 'TTD').length

  function updateRow(id: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, ...patch, error: undefined } : r))
    setTopError('')
  }
  function addRow() {
    setRows((prev) => [...prev, newRow()])
  }
  function removeRow(id: number) {
    setRows((prev) => prev.length === 1 ? prev : prev.filter((r) => r.id !== id))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setTopError('')

    // Local-only validation pass — the server re-validates everything.
    const cleaned = rows.map((r) => ({ ...r, error: undefined as string | undefined }))
    cleaned.forEach((r) => {
      if (!r.url.trim()) r.error = 'Pega el link de tu TikTok'
      else if (!r.type) r.error = 'Selecciona ACC o TTD'
    })
    if (cleaned.some((r) => r.error)) {
      setRows(cleaned)
      setTopError('Revisa los errores marcados')
      return
    }

    setLoading(true)
    const result = await submitBoostBatch({
      creator_id: creatorId,
      creator_name: creatorName,
      tiktok_handle: tiktokHandle,
      videos: cleaned.map((r) => ({ tiktok_url: r.url, video_type: r.type as 'ACC' | 'TTD', boost_requested: r.boost })),
    })
    setLoading(false)

    if (result.error) {
      setTopError(result.error)
      return
    }
    if (result.rowErrors && result.rowErrors.length > 0) {
      const next = [...rows]
      for (const re of result.rowErrors) {
        if (next[re.index]) next[re.index] = { ...next[re.index], error: re.message }
      }
      setRows(next)
      setTopError('Revisa los errores marcados')
      return
    }

    setSubmittedCount(result.inserted ?? 0)
    setRows([newRow()])
    // Pull fresh server data so the "this month" counter reflects the
    // newly submitted rows on the next render.
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* Running totals */}
      <div className="bg-go-orange/10 border border-go-orange/30 rounded-2xl px-5 py-3 flex items-center justify-center gap-3 flex-wrap">
        <span className="font-dm text-xs font-semibold text-go-dark/70 uppercase tracking-wide">Este mes:</span>
        <span className="font-syne font-bold text-base text-blue-700 bg-blue-100 px-3 py-0.5 rounded-full">{accCount} ACC</span>
        <span className="font-syne font-bold text-base text-purple-700 bg-purple-100 px-3 py-0.5 rounded-full">{ttdCount} TTD</span>
        <span className="font-dm text-xs text-go-dark/50">· {accCount + ttdCount} videos en total</span>
      </div>

      {/* Submit form */}
      <div className="bg-white border border-[rgba(255,119,0,0.12)] rounded-2xl p-5 shadow-sm">
        <h2 className="font-syne font-bold text-lg text-go-dark mb-1">🎬 Sube tus videos</h2>
        <p className="font-dm text-xs text-gray-400 mb-4">Agrega uno o más links de TikTok. Cada video cuenta cuando tu equipo lo aprueba.</p>

        {/* Short-link warning */}
        <div className="bg-yellow-50 border border-yellow-300 rounded-xl px-4 py-3 mb-4">
          <p className="font-dm text-sm text-yellow-900 leading-snug">
            ⚠️ <strong>Importante:</strong> Para asegurarte de que tu link funcione correctamente, usa el link <strong>completo</strong> de tu video (no el link corto).
          </p>
          <p className="font-dm text-xs text-yellow-800/80 mt-2">
            En TikTok ve a tu video → compartir → copiar link → pega el link completo.
          </p>
          <ul className="mt-2 space-y-0.5 text-xs font-mono text-yellow-900">
            <li><span className="font-sans">✅ Correcto:</span> https://www.tiktok.com/@tuusuario/video/1234567890</li>
            <li><span className="font-sans">❌ Evita:</span> https://www.tiktok.com/t/xxxxx</li>
          </ul>
        </div>

        {submittedCount != null ? (
          <div className="text-center py-8">
            <p className="font-dm text-go-orange font-semibold text-lg">
              ✅ {submittedCount} {submittedCount === 1 ? 'video agregado' : 'videos agregados'} correctamente
            </p>
            <p className="font-dm text-xs text-gray-500 mt-2">
              Tu equipo revisará y aprobará. Te avisamos por aquí.
            </p>
            <button
              onClick={() => setSubmittedCount(null)}
              className="mt-4 font-dm text-sm text-gray-400 underline hover:text-go-orange transition-colors"
            >
              Enviar más videos
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {rows.map((r, idx) => (
              <div key={r.id} className="bg-go-light/50 border border-go-border rounded-xl p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <label className="block font-dm text-[11px] font-semibold text-go-dark/50 uppercase tracking-wide mb-1">
                      Video {idx + 1} — TikTok URL
                    </label>
                    <input
                      type="url"
                      value={r.url}
                      onChange={(e) => updateRow(r.id, { url: e.target.value })}
                      placeholder="https://www.tiktok.com/@..."
                      className={`w-full border rounded-lg px-3 py-2 font-dm text-sm text-go-dark placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-go-orange/30 focus:border-go-orange transition-all ${r.error ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}
                    />
                    {isShortTikTokLink(r.url) && (
                      <div className="mt-2 bg-orange-50 border border-orange-300 rounded-lg px-3 py-2">
                        <p className="font-dm text-xs font-semibold text-orange-900">
                          ⚠️ Detectamos un link corto. Para que funcione correctamente, sigue estos pasos:
                        </p>
                        <ol className="font-dm text-xs text-orange-900/90 mt-1 list-decimal list-inside space-y-0.5">
                          <li>Abre el link en TikTok</li>
                          <li>Toca los 3 puntos (...) en tu video</li>
                          <li>Toca &lsquo;Copiar link&rsquo;</li>
                          <li>Pega el nuevo link aquí</li>
                        </ol>
                      </div>
                    )}
                  </div>
                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRow(r.id)}
                      className="mt-6 text-red-400 hover:text-red-600 text-lg leading-none px-2"
                      aria-label="Eliminar"
                    >×</button>
                  )}
                </div>
                <div>
                  <label className="block font-dm text-[11px] font-semibold text-go-dark/50 uppercase tracking-wide mb-1">Tipo</label>
                  <div className="flex gap-2">
                    {(['ACC', 'TTD'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => updateRow(r.id, { type: t })}
                        className={`flex-1 py-2 rounded-lg font-dm font-semibold text-xs transition-all border-2 ${
                          r.type === t
                            ? 'bg-go-orange text-white border-go-orange'
                            : 'bg-white text-go-dark/60 border-gray-200 hover:border-go-orange/40'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={r.boost}
                    onChange={(e) => updateRow(r.id, { boost: e.target.checked })}
                    className="w-4 h-4 accent-go-orange"
                  />
                  <span className="font-dm text-xs text-go-dark/70">Quiero que Papaya booste este video 🚀</span>
                </label>
                {r.error && <p className="font-dm text-xs text-red-600">{r.error}</p>}
              </div>
            ))}

            <button
              type="button"
              onClick={addRow}
              className="w-full border-2 border-dashed border-go-orange/40 text-go-orange font-dm text-xs font-semibold py-2 rounded-lg hover:bg-go-orange/5 transition"
            >
              + Agregar otro video
            </button>

            {topError && (
              <p className="font-dm text-sm text-red-500">{topError}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-go-orange hover:bg-go-orange/90 text-white font-dm font-semibold text-sm py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Enviando...' : `Enviar ${rows.length} ${rows.length === 1 ? 'video' : 'videos'} 🚀`}
            </button>
          </form>
        )}
      </div>

      {/* Past requests */}
      <div className="bg-white border border-[rgba(255,119,0,0.12)] rounded-2xl p-5 shadow-sm">
        <h2 className="font-syne font-bold text-lg text-go-dark mb-4">Tus solicitudes anteriores</h2>

        {pastRequests.length === 0 ? (
          <p className="font-dm text-sm text-gray-400 text-center py-6">
            Aún no has enviado ningún video
          </p>
        ) : (
          <div className="space-y-3">
            {pastRequests.map((req) => (
              <div
                key={req.id}
                className="border border-gray-100 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-dm text-xs text-gray-400">
                    {new Date(req.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                  {req.tiktok_url && (
                    <a
                      href={req.tiktok_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-dm text-sm text-go-orange hover:underline truncate block"
                    >
                      {truncateUrl(req.tiktok_url)}
                    </a>
                  )}
                  {req.status === 'rejected' && req.rejection_reason && (
                    <p className="font-dm text-xs text-red-600 mt-1">Razón: {req.rejection_reason}</p>
                  )}
                </div>
                <div className="shrink-0">
                  {statusBadge(req.status)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
