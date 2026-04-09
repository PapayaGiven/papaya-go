'use client'

import { useState } from 'react'
import { submitBoost } from './actions'
import type { BoostRequest } from '@/lib/types'

interface BoostClientProps {
  creatorId: string
  creatorName: string | null
  tiktokHandle: string | null
  pastRequests: BoostRequest[]
}

function statusBadge(status: string) {
  switch (status) {
    case 'boosted':
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-dm font-medium bg-green-100 text-green-700">✅ Boosteado</span>
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
  const [tiktokUrl, setTiktokUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!tiktokUrl.trim()) {
      setError('Pega el link de tu TikTok')
      return
    }
    setLoading(true)
    try {
      const result = await submitBoost({
        creator_id: creatorId,
        creator_name: creatorName,
        tiktok_handle: tiktokHandle,
        tiktok_url: tiktokUrl.trim(),
        boost_reason: null,
        notes: notes.trim() || null,
      })
      if (result.error) {
        setError(result.error)
      } else {
        setSubmitted(true)
        setTiktokUrl('')
        setNotes('')
      }
    } catch {
      setError('Algo salio mal. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Submit form */}
      <div className="bg-white border border-[rgba(255,119,0,0.12)] rounded-2xl p-5 shadow-sm">
        <h2 className="font-syne font-bold text-lg text-go-dark mb-1">Opcion A — Link de TikTok</h2>
        <p className="font-dm text-xs text-gray-400 mb-4">Pega el link de tu video publicado en TikTok</p>

        {submitted ? (
          <div className="text-center py-8">
            <p className="font-dm text-go-orange font-semibold text-lg">
              ¡Video enviado para boost! Te avisamos cuando este listo 🧡
            </p>
            <button
              onClick={() => setSubmitted(false)}
              className="mt-4 font-dm text-sm text-gray-400 underline hover:text-go-orange transition-colors"
            >
              Enviar otro video
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* TikTok URL */}
            <div>
              <label className="block font-dm text-sm font-medium text-go-dark mb-1">
                Pega el link de tu TikTok
              </label>
              <input
                type="url"
                value={tiktokUrl}
                onChange={(e) => setTiktokUrl(e.target.value)}
                placeholder="https://www.tiktok.com/@..."
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 font-dm text-sm text-go-dark placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-go-orange/30 focus:border-go-orange transition-all"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block font-dm text-sm font-medium text-go-dark mb-1">
                Notas adicionales (opcional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Algo que quieras que sepamos..."
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 font-dm text-sm text-go-dark placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-go-orange/30 focus:border-go-orange transition-all resize-none"
              />
            </div>

            {error && (
              <p className="font-dm text-sm text-red-500">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-go-orange hover:bg-go-orange/90 text-white font-dm font-semibold text-sm py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Enviando...' : 'Enviar para boost 🚀'}
            </button>
          </form>
        )}
      </div>

      {/* Past requests */}
      <div className="bg-white border border-[rgba(255,119,0,0.12)] rounded-2xl p-5 shadow-sm">
        <h2 className="font-syne font-bold text-lg text-go-dark mb-4">Tus solicitudes anteriores</h2>

        {pastRequests.length === 0 ? (
          <p className="font-dm text-sm text-gray-400 text-center py-6">
            Aun no has enviado ningun video para boost
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
                    {new Date(req.created_at).toLocaleDateString('es-MX', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
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
                  {req.boost_reason && (
                    <p className="font-dm text-xs text-gray-500 mt-0.5">{req.boost_reason}</p>
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
