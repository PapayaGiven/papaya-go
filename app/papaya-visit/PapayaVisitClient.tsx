'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { POI_TYPE_LABELS, NIVEL_NAMES } from '@/lib/types'
import type { POI } from '@/lib/types'
import { submitPOIRequest } from '@/app/pois/actions'

interface Props {
  pois: POI[]
  creatorNivel: number
  creatorId: string
  creatorName: string | null
  tiktokHandle: string | null
}

const TYPE_TABS = [
  { id: 'all', label: 'Todos' },
  { id: 'hotel', label: 'Hoteles' },
  { id: 'attraction', label: 'Atracciones' },
  { id: 'restaurant', label: 'Restaurantes' },
]

export default function PapayaVisitClient({ pois, creatorNivel, creatorId, creatorName, tiktokHandle }: Props) {
  const [activeType, setActiveType] = useState('all')
  const [requestForm, setRequestForm] = useState({
    place_name: '',
    city_state: '',
    place_type: 'Hotel',
    reason: '',
  })
  const [requestSubmitted, setRequestSubmitted] = useState(false)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const filteredPois = useMemo(() => {
    if (activeType === 'all') return pois
    return pois.filter((p) => p.type === activeType)
  }, [pois, activeType])

  async function handleRequestSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setRequestError(null)
    const result = await submitPOIRequest({
      creator_id: creatorId,
      creator_name: creatorName,
      tiktok_handle: tiktokHandle,
      place_name: requestForm.place_name,
      city_state: requestForm.city_state,
      place_type: requestForm.place_type,
      reason: requestForm.reason,
    })
    setSubmitting(false)
    if (result.error) {
      setRequestError(result.error)
    } else {
      setRequestSubmitted(true)
    }
  }

  return (
    <>
      {/* Type filter tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {TYPE_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveType(tab.id)}
            className={`px-4 py-2 rounded-xl font-dm text-sm font-medium whitespace-nowrap transition-colors ${
              activeType === tab.id
                ? 'bg-go-orange text-white'
                : 'bg-white text-gray-600 border border-[rgba(255,119,0,0.12)] hover:border-go-orange/30 hover:text-go-orange'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* POI grid */}
      {filteredPois.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[rgba(255,119,0,0.1)] p-12 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://mmhsulgcowhqimypglul.supabase.co/storage/v1/object/public/PGLOGOS/PapayaGo-Sun-Orange-39.png"
            alt=""
            className="w-16 h-16 mx-auto mb-4 opacity-30"
          />
          <p className="font-dm text-sm text-gray-400">
            Pronto añadiremos más Papaya Visits 🌺
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPois.map((poi) => {
            const isLocked = poi.min_nivel > creatorNivel
            const typeInfo = POI_TYPE_LABELS[poi.type] ?? { label: poi.type, color: 'bg-gray-100 text-gray-700' }

            if (isLocked) {
              return (
                <div key={poi.id} className="bg-white/60 rounded-2xl border border-[rgba(255,119,0,0.1)] p-5 opacity-60 select-none">
                  <div className="h-[3px] rounded-t-2xl bg-gradient-to-r from-[#ff7700] to-[#ffcba4] -mx-5 -mt-5 mb-4" />
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-3xl grayscale">{poi.image_emoji ?? '🔒'}</span>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-syne font-bold text-base text-gray-400 truncate">{poi.name}</h3>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`font-dm text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${typeInfo.color}`}>
                          {typeInfo.label}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="font-dm text-xs text-gray-400 mb-3">{poi.city}, {poi.state}</p>
                  <div className="flex items-center gap-2 text-gray-400">
                    <span className="text-lg">🔒</span>
                    <span className="font-dm text-xs font-medium">Disponible en Nivel {poi.min_nivel}{NIVEL_NAMES[poi.min_nivel] ? ` (${NIVEL_NAMES[poi.min_nivel]})` : ''}</span>
                  </div>
                </div>
              )
            }

            return (
              <div key={poi.id} className="bg-white rounded-2xl border border-[rgba(255,119,0,0.1)] overflow-hidden hover:shadow-md transition-shadow">
                <div className="h-[3px] bg-gradient-to-r from-[#ff7700] to-[#ffcba4]" />
                <div className="p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-3xl">{poi.image_emoji ?? '🌺'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-dm text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                          🌺 Papaya Visit
                        </span>
                        <span className={`font-dm text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${typeInfo.color}`}>
                          {typeInfo.label}
                        </span>
                      </div>
                      <h3 className="font-syne font-bold text-base text-[#1a0800] truncate">{poi.name}</h3>
                    </div>
                  </div>
                  <p className="font-dm text-xs text-gray-500 mb-3">{poi.city}, {poi.state}</p>

                  {poi.perk && (
                    <div className="bg-[#fff8f2] border border-[rgba(255,119,0,0.08)] rounded-xl p-3 mb-4">
                      <p className="font-dm text-sm font-medium text-gray-800">{poi.perk}</p>
                    </div>
                  )}

                  {poi.commission && (
                    <p className="font-dm text-sm font-bold text-go-orange mb-4">{poi.commission}</p>
                  )}

                  <div className="space-y-2">
                    {poi.cta_label && poi.cta_url && (
                      <a
                        href={poi.cta_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-center py-2.5 rounded-xl font-dm text-xs font-semibold text-white bg-go-orange hover:bg-go-orange/90 transition"
                      >
                        {poi.cta_label}
                      </a>
                    )}
                    <Link
                      href={`/ai-coach?place=${encodeURIComponent(poi.name)}`}
                      className="block text-center py-2 rounded-xl font-dm text-xs font-semibold text-go-orange hover:text-orange-600 transition-colors"
                    >
                      ✨ Crear contenido
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Bottom section: suggest a place */}
      <div className="mt-10">
        <h2 className="font-syne font-bold text-lg text-[#1a0800] mb-4">¿Conoces un lugar que debería estar aquí?</h2>

        {requestSubmitted ? (
          <div className="bg-white rounded-2xl border border-[rgba(255,119,0,0.1)] p-10 text-center max-w-lg mx-auto">
            <p className="text-4xl mb-3">🧡</p>
            <p className="font-dm text-[#1a0800] text-sm font-medium">
              ¡Solicitud enviada! Te avisamos cuando tengamos algo 🧡
            </p>
          </div>
        ) : (
          <form onSubmit={handleRequestSubmit} className="bg-white rounded-2xl border border-[rgba(255,119,0,0.1)] p-6 space-y-4 max-w-lg">
            <div>
              <label className="font-dm text-sm font-medium text-[#1a0800] block mb-1">Nombre del lugar *</label>
              <input
                type="text"
                required
                value={requestForm.place_name}
                onChange={(e) => setRequestForm((f) => ({ ...f, place_name: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-[rgba(255,119,0,0.12)] bg-white font-dm text-sm text-[#1a0800] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-go-orange/30"
                placeholder="Ej. Hotel Xcaret"
              />
            </div>

            <div>
              <label className="font-dm text-sm font-medium text-[#1a0800] block mb-1">Ciudad y estado *</label>
              <input
                type="text"
                required
                value={requestForm.city_state}
                onChange={(e) => setRequestForm((f) => ({ ...f, city_state: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-[rgba(255,119,0,0.12)] bg-white font-dm text-sm text-[#1a0800] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-go-orange/30"
                placeholder="Ej. Cancún, Quintana Roo"
              />
            </div>

            <div>
              <label className="font-dm text-sm font-medium text-[#1a0800] block mb-1">Tipo de lugar</label>
              <select
                value={requestForm.place_type}
                onChange={(e) => setRequestForm((f) => ({ ...f, place_type: e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-[rgba(255,119,0,0.12)] bg-white font-dm text-sm text-[#1a0800] focus:outline-none focus:ring-2 focus:ring-go-orange/30"
              >
                <option value="Hotel">Hotel</option>
                <option value="Atracción">Atracción</option>
                <option value="Restaurante">Restaurante</option>
                <option value="Otro">Otro</option>
              </select>
            </div>

            <div>
              <label className="font-dm text-sm font-medium text-[#1a0800] block mb-1">¿Por qué lo recomiendas?</label>
              <textarea
                value={requestForm.reason}
                onChange={(e) => setRequestForm((f) => ({ ...f, reason: e.target.value }))}
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl border border-[rgba(255,119,0,0.12)] bg-white font-dm text-sm text-[#1a0800] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-go-orange/30 resize-none"
                placeholder="Ej. Tiene muy buenas vistas, es popular en TikTok..."
              />
            </div>

            {requestError && (
              <p className="font-dm text-sm text-red-500">{requestError}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl font-dm text-sm font-semibold text-white bg-go-orange hover:bg-go-orange/90 disabled:opacity-50 transition"
            >
              {submitting ? 'Enviando...' : 'Enviar solicitud'}
            </button>
          </form>
        )}
      </div>
    </>
  )
}
