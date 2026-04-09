'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { POI_TYPE_LABELS } from '@/lib/types'
import type { POI } from '@/lib/types'
import { submitPOIRequest } from './actions'

interface Props {
  pois: POI[]
  creatorNivel: number
  creatorId: string
  creatorName: string | null
  tiktokHandle: string | null
}

const TABS = [
  { id: 1, label: '🏨 Nuestros POIs' },
  { id: 2, label: '🔥 POIs Virales' },
  { id: 3, label: '📍 Explorar por Ciudad' },
  { id: 4, label: '🙋 Solicitar Lugar' },
]

const TYPE_FILTERS = [
  { label: 'Todos', value: '' },
  { label: 'Hoteles', value: 'hotel' },
  { label: 'Atracciones', value: 'attraction' },
  { label: 'Restaurantes', value: 'restaurant' },
]

export default function POIsClient({ pois, creatorNivel, creatorId, creatorName, tiktokHandle }: Props) {
  const [activeTab, setActiveTab] = useState(1)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [requestForm, setRequestForm] = useState({
    place_name: '',
    city_state: '',
    place_type: 'Hotel',
    reason: '',
    tiktok_handle: tiktokHandle ?? '',
  })
  const [requestSubmitted, setRequestSubmitted] = useState(false)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const uniqueCities = useMemo(() => {
    const cities = Array.from(new Set(pois.map((p) => p.city))).sort()
    return cities
  }, [pois])

  const filteredPois = useMemo(() => {
    let result = pois
    if (typeFilter) result = result.filter((p) => p.type === typeFilter)
    if (cityFilter) result = result.filter((p) => p.city === cityFilter)
    return result
  }, [pois, typeFilter, cityFilter])

  const viralPois = useMemo(() => {
    return pois
      .filter((p) => p.times_sold > 0)
      .sort((a, b) => b.times_sold - a.times_sold)
  }, [pois])

  const citySearchPois = useMemo(() => {
    if (!search.trim()) return pois
    const q = search.toLowerCase()
    return pois.filter(
      (p) =>
        p.city.toLowerCase().includes(q) ||
        p.state.toLowerCase().includes(q)
    )
  }, [pois, search])

  async function handleRequestSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setRequestError(null)
    const result = await submitPOIRequest({
      creator_id: creatorId,
      creator_name: creatorName,
      tiktok_handle: requestForm.tiktok_handle || null,
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

  function renderPOICard(poi: POI) {
    const isLocked = poi.min_nivel > creatorNivel
    const typeInfo = POI_TYPE_LABELS[poi.type] ?? { label: poi.type, color: 'bg-gray-100 text-gray-700' }

    if (isLocked) {
      return (
        <div key={poi.id} className="bg-white/60 rounded-2xl border border-[rgba(255,119,0,0.12)] p-5 opacity-60 select-none">
          <div className="flex items-center justify-between mb-3">
            <span className="text-3xl grayscale">{poi.image_emoji ?? '🔒'}</span>
            <span className={`font-dm text-[11px] font-semibold px-2.5 py-1 rounded-full ${typeInfo.color}`}>
              {typeInfo.label}
            </span>
          </div>
          <h3 className="font-syne font-bold text-base text-gray-400 mb-1">{poi.name}</h3>
          <p className="font-dm text-xs text-gray-400 mb-4">{poi.city}, {poi.state}</p>
          <div className="flex items-center gap-2 text-gray-400">
            <span className="text-lg">🔒</span>
            <span className="font-dm text-xs font-medium">Disponible en Nivel {poi.min_nivel}</span>
          </div>
        </div>
      )
    }

    return (
      <div key={poi.id} className="bg-white rounded-2xl border border-[rgba(255,119,0,0.12)] p-5 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-3">
          <span className="text-3xl">{poi.image_emoji ?? '📍'}</span>
          <span className={`font-dm text-[11px] font-semibold px-2.5 py-1 rounded-full ${typeInfo.color}`}>
            {typeInfo.label}
          </span>
        </div>
        <h3 className="font-syne font-bold text-base text-go-dark mb-1">{poi.name}</h3>
        <p className="font-dm text-xs text-gray-500 mb-3">{poi.city}, {poi.state}</p>
        <div className="space-y-1.5 mb-4">
          <p className="font-dm text-xs">
            <span className="font-semibold text-go-orange">{poi.commission}</span>
          </p>
          {poi.perk && (
            <p className="font-dm text-xs text-gray-600">{poi.perk}</p>
          )}
        </div>
        <Link
          href={`/ai-coach?poi=${poi.id}`}
          className="block text-center py-2 rounded-xl font-dm text-xs font-semibold text-white bg-go-orange hover:bg-go-orange/90 transition"
        >
          ✨ Usar en AI Coach
        </Link>
      </div>
    )
  }

  return (
    <>
      {/* Tab buttons */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-xl font-dm text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'bg-go-orange text-white'
                : 'bg-white text-gray-600 border border-[rgba(255,119,0,0.12)] hover:border-go-orange/30 hover:text-go-orange'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: Nuestros POIs */}
      {activeTab === 1 && (
        <div>
          {/* City filter */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-[rgba(255,119,0,0.12)] bg-white font-dm text-sm text-go-dark focus:outline-none focus:ring-2 focus:ring-go-orange/30"
            >
              <option value="">Todas las ciudades</option>
              {uniqueCities.map((city) => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>

          {/* Type filter */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setTypeFilter(f.value)}
                className={`px-4 py-2 rounded-xl font-dm text-sm font-medium whitespace-nowrap transition-colors ${
                  typeFilter === f.value
                    ? 'bg-go-orange text-white'
                    : 'bg-white text-gray-600 border border-[rgba(255,119,0,0.12)] hover:border-go-orange/30 hover:text-go-orange'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Grid */}
          {filteredPois.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[rgba(255,119,0,0.12)] p-10 text-center">
              <p className="text-4xl mb-3">📍</p>
              <p className="font-dm text-gray-500 text-sm">No se encontraron POIs con este filtro.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPois.map((poi) => renderPOICard(poi))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: POIs Virales */}
      {activeTab === 2 && (
        <div>
          {viralPois.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[rgba(255,119,0,0.12)] p-10 text-center">
              <p className="text-4xl mb-3">🌞</p>
              <p className="font-dm text-gray-500 text-sm">Pronto aparecerán los POIs más vendidos</p>
            </div>
          ) : (
            <div className="space-y-3">
              {viralPois.map((poi, index) => {
                const typeInfo = POI_TYPE_LABELS[poi.type] ?? { label: poi.type, color: 'bg-gray-100 text-gray-700' }
                return (
                  <div
                    key={poi.id}
                    className="bg-white rounded-2xl border border-[rgba(255,119,0,0.12)] p-5 flex items-center gap-4 hover:shadow-md transition-shadow"
                  >
                    <span className="font-syne font-extrabold text-2xl text-go-orange/40 w-10 text-center shrink-0">
                      #{index + 1}
                    </span>
                    <span className="text-2xl shrink-0">{poi.image_emoji ?? '📍'}</span>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-syne font-bold text-base text-go-dark truncate">{poi.name}</h3>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`font-dm text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${typeInfo.color}`}>
                          {typeInfo.label}
                        </span>
                        <span className="font-dm text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-orange-100 text-go-orange">
                          {poi.times_sold} veces vendido
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Explorar por Ciudad */}
      {activeTab === 3 && (
        <div>
          <input
            type="text"
            placeholder="Buscar ciudad o estado..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full mb-6 px-4 py-3 rounded-xl border border-[rgba(255,119,0,0.12)] bg-white font-dm text-sm text-go-dark placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-go-orange/30"
          />

          {search.trim() && citySearchPois.length === 0 ? (
            <div className="bg-white rounded-2xl border border-[rgba(255,119,0,0.12)] p-10 text-center">
              <p className="text-4xl mb-3">📍</p>
              <p className="font-dm text-gray-500 text-sm">No encontramos POIs en &ldquo;{search}&rdquo; todavía.</p>
              <button
                onClick={() => setActiveTab(4)}
                className="mt-4 inline-block font-dm text-sm font-semibold text-go-orange hover:underline"
              >
                🙋 Solicitar un hotel o atracción →
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {citySearchPois.map((poi) => renderPOICard(poi))}
              </div>
              {search.trim() && (
                <div className="mt-6 text-center">
                  <button
                    onClick={() => setActiveTab(4)}
                    className="font-dm text-sm font-semibold text-go-orange hover:underline"
                  >
                    🙋 Solicitar un hotel o atracción →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* TAB 4: Solicitar Lugar */}
      {activeTab === 4 && (
        <div className="max-w-lg mx-auto">
          {requestSubmitted ? (
            <div className="bg-white rounded-2xl border border-[rgba(255,119,0,0.12)] p-10 text-center">
              <p className="text-4xl mb-3">🧡</p>
              <p className="font-dm text-go-dark text-sm font-medium">
                ¡Solicitud enviada! Te avisamos cuando tengamos algo 🧡
              </p>
            </div>
          ) : (
            <form onSubmit={handleRequestSubmit} className="bg-white rounded-2xl border border-[rgba(255,119,0,0.12)] p-6 space-y-4">
              <h2 className="font-syne font-bold text-lg text-go-dark">Solicitar un lugar nuevo</h2>
              <p className="font-dm text-sm text-gray-400">¿Conoces un hotel o atracción que deberíamos agregar?</p>

              <div>
                <label className="font-dm text-sm font-medium text-go-dark block mb-1">Nombre del lugar *</label>
                <input
                  type="text"
                  required
                  value={requestForm.place_name}
                  onChange={(e) => setRequestForm((f) => ({ ...f, place_name: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-[rgba(255,119,0,0.12)] bg-white font-dm text-sm text-go-dark placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-go-orange/30"
                  placeholder="Ej. Hotel Xcaret"
                />
              </div>

              <div>
                <label className="font-dm text-sm font-medium text-go-dark block mb-1">Ciudad y estado *</label>
                <input
                  type="text"
                  required
                  value={requestForm.city_state}
                  onChange={(e) => setRequestForm((f) => ({ ...f, city_state: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-[rgba(255,119,0,0.12)] bg-white font-dm text-sm text-go-dark placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-go-orange/30"
                  placeholder="Ej. Cancún, Quintana Roo"
                />
              </div>

              <div>
                <label className="font-dm text-sm font-medium text-go-dark block mb-1">Tipo de lugar</label>
                <select
                  value={requestForm.place_type}
                  onChange={(e) => setRequestForm((f) => ({ ...f, place_type: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-[rgba(255,119,0,0.12)] bg-white font-dm text-sm text-go-dark focus:outline-none focus:ring-2 focus:ring-go-orange/30"
                >
                  <option value="Hotel">Hotel</option>
                  <option value="Atracción">Atracción</option>
                  <option value="Restaurante">Restaurante</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>

              <div>
                <label className="font-dm text-sm font-medium text-go-dark block mb-1">¿Por qué lo recomiendas?</label>
                <textarea
                  value={requestForm.reason}
                  onChange={(e) => setRequestForm((f) => ({ ...f, reason: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl border border-[rgba(255,119,0,0.12)] bg-white font-dm text-sm text-go-dark placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-go-orange/30 resize-none"
                  placeholder="Ej. Tiene muy buenas vistas, es popular en TikTok..."
                />
              </div>

              <div>
                <label className="font-dm text-sm font-medium text-go-dark block mb-1">Tu TikTok handle</label>
                <input
                  type="text"
                  value={requestForm.tiktok_handle}
                  onChange={(e) => setRequestForm((f) => ({ ...f, tiktok_handle: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-[rgba(255,119,0,0.12)] bg-white font-dm text-sm text-go-dark placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-go-orange/30"
                  placeholder="@tucuenta"
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
      )}
    </>
  )
}
