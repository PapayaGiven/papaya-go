'use client'

import { useState } from 'react'
import type { POI, CapCutTemplate } from '@/lib/types'
import { POI_TYPE_LABELS } from '@/lib/types'

const CONTENT_TYPES = [
  { key: 'hook', label: '🎣 Hook' },
  { key: 'caption', label: '✍️ Caption' },
  { key: 'voiceover', label: '🎙️ Voiceover 30 seg' },
  { key: 'ideas', label: '💡 Ideas de video' },
] as const

type ContentType = (typeof CONTENT_TYPES)[number]['key']

const VIDEO_TYPE_BADGES: Record<string, { label: string; color: string }> = {
  ACC: { label: 'ACC', color: 'bg-blue-100 text-blue-700' },
  TTD: { label: 'TTD', color: 'bg-purple-100 text-purple-700' },
  general: { label: 'General', color: 'bg-gray-100 text-gray-600' },
}

interface Props {
  pois: POI[]
  templates: CapCutTemplate[]
  preselectedPoiId: string | null
}

export default function AICoachClient({ pois, templates, preselectedPoiId }: Props) {
  const [selectedPoiId, setSelectedPoiId] = useState<string>(preselectedPoiId ?? '')
  const [customLocation, setCustomLocation] = useState('')
  const [useCustom, setUseCustom] = useState(false)
  const [contentType, setContentType] = useState<ContentType | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const selectedPoi = pois.find((p) => p.id === selectedPoiId) ?? null

  async function handleGenerate() {
    if (!contentType) return

    let poiName: string
    let poiCity = ''
    let poiState = ''
    let poiType = ''
    let poiCommission = ''

    if (useCustom) {
      if (!customLocation.trim()) return
      poiName = customLocation.trim()
    } else {
      if (!selectedPoi) return
      poiName = selectedPoi.name
      poiCity = selectedPoi.city
      poiState = selectedPoi.state
      poiType = POI_TYPE_LABELS[selectedPoi.type]?.label ?? selectedPoi.type
      poiCommission = selectedPoi.commission
    }

    setLoading(true)
    setError(null)
    setResult(null)
    setCopied(false)

    try {
      const res = await fetch('/api/ai-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poi_name: poiName,
          poi_city: poiCity,
          poi_state: poiState,
          poi_type: poiType,
          poi_commission: poiCommission,
          content_type: contentType,
        }),
      })

      if (!res.ok) {
        throw new Error('Error al generar contenido.')
      }

      const data = await res.json()
      setResult(data.text)
    } catch {
      setError('Hubo un error al generar el contenido. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    if (!result) return
    await navigator.clipboard.writeText(result)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const canGenerate =
    contentType && (useCustom ? customLocation.trim().length > 0 : !!selectedPoi)

  return (
    <div className="space-y-8">
      {/* Step 1: Select POI */}
      <div className="bg-white rounded-2xl border border-go-border p-6">
        <h2 className="font-syne font-bold text-lg text-go-dark mb-1">
          1. Selecciona un lugar
        </h2>
        <p className="font-dm text-sm text-gray-500 mb-4">
          Elige un lugar de la lista o escribe uno personalizado.
        </p>

        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => setUseCustom(false)}
            className={`font-dm text-sm px-4 py-2 rounded-xl border transition ${
              !useCustom
                ? 'bg-go-orange text-white border-go-orange'
                : 'bg-white text-gray-600 border-go-border hover:border-go-orange'
            }`}
          >
            De la lista
          </button>
          <button
            onClick={() => setUseCustom(true)}
            className={`font-dm text-sm px-4 py-2 rounded-xl border transition ${
              useCustom
                ? 'bg-go-orange text-white border-go-orange'
                : 'bg-white text-gray-600 border-go-border hover:border-go-orange'
            }`}
          >
            Personalizado
          </button>
        </div>

        {useCustom ? (
          <input
            type="text"
            value={customLocation}
            onChange={(e) => setCustomLocation(e.target.value)}
            placeholder="Ej: The Ritz-Carlton, Miami Beach, FL"
            className="input-field"
          />
        ) : (
          <select
            value={selectedPoiId}
            onChange={(e) => setSelectedPoiId(e.target.value)}
            className="input-field"
          >
            <option value="">Selecciona un lugar...</option>
            {pois.map((poi) => (
              <option key={poi.id} value={poi.id}>
                {poi.image_emoji ?? '📍'} {poi.name} — {poi.city}, {poi.state}
              </option>
            ))}
          </select>
        )}

        {!useCustom && selectedPoi && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className={`font-dm text-xs font-medium px-2.5 py-1 rounded-full ${
                POI_TYPE_LABELS[selectedPoi.type]?.color ?? 'bg-gray-100 text-gray-600'
              }`}
            >
              {POI_TYPE_LABELS[selectedPoi.type]?.label ?? selectedPoi.type}
            </span>
            <span className="font-dm text-xs text-gray-500">
              Comision: {selectedPoi.commission}
            </span>
          </div>
        )}
      </div>

      {/* Step 2: Select content type */}
      <div className="bg-white rounded-2xl border border-go-border p-6">
        <h2 className="font-syne font-bold text-lg text-go-dark mb-1">
          2. Tipo de contenido
        </h2>
        <p className="font-dm text-sm text-gray-500 mb-4">
          Elige que quieres generar.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {CONTENT_TYPES.map((ct) => (
            <button
              key={ct.key}
              onClick={() => setContentType(ct.key)}
              className={`font-dm text-sm font-medium px-4 py-3 rounded-xl border transition text-center ${
                contentType === ct.key
                  ? 'bg-go-orange text-white border-go-orange'
                  : 'bg-white text-gray-600 border-go-border hover:border-go-orange hover:text-go-orange'
              }`}
            >
              {ct.label}
            </button>
          ))}
        </div>
      </div>

      {/* Step 3: Generate */}
      <div className="flex gap-3">
        <button
          onClick={handleGenerate}
          disabled={!canGenerate || loading}
          className="flex-1 py-3.5 rounded-xl font-dm font-semibold text-sm text-white bg-go-orange hover:bg-go-orange/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Generando...
            </span>
          ) : 'Generar con AI Coach'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <p className="text-sm font-dm text-red-600">{error}</p>
        </div>
      )}

      {/* Step 4: Output */}
      {result && (
        <div className="bg-white rounded-2xl border border-go-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-syne font-bold text-lg text-go-dark">
              Resultado
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className={`font-dm text-sm font-medium px-4 py-2 rounded-xl border transition ${
                  copied
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                    : 'bg-white text-gray-600 border-go-border hover:border-go-orange hover:text-go-orange'
                }`}
              >
                {copied ? '¡Copiado! ✓' : '📋 Copiar'}
              </button>
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="font-dm text-sm font-medium px-4 py-2 rounded-xl border border-go-border bg-white text-gray-600 hover:border-go-orange hover:text-go-orange transition disabled:opacity-50"
              >
                🔄 Regenerar
              </button>
            </div>
          </div>
          <div className="font-dm text-sm text-go-dark leading-relaxed whitespace-pre-wrap">
            {result}
          </div>
        </div>
      )}

      {/* Step 5: CapCut Templates */}
      {templates.length > 0 && (
        <div>
          <h2 className="font-syne font-bold text-lg text-go-dark mb-1">
            Plantillas de CapCut
          </h2>
          <p className="font-dm text-sm text-gray-500 mb-4">
            Usa estas plantillas para crear tus videos mas rapido.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template) => {
              const badge = VIDEO_TYPE_BADGES[template.video_type] ?? VIDEO_TYPE_BADGES.general
              return (
                <div
                  key={template.id}
                  className="bg-white rounded-2xl border border-go-border p-5 flex flex-col"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-syne font-bold text-sm text-go-dark">
                      {template.title}
                    </h3>
                    <span
                      className={`font-dm text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${badge.color}`}
                    >
                      {badge.label}
                    </span>
                  </div>
                  {template.description && (
                    <p className="font-dm text-xs text-gray-500 mb-4 flex-1">
                      {template.description}
                    </p>
                  )}
                  <a
                    href={template.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-dm text-sm font-semibold text-go-orange hover:text-go-orange/80 transition mt-auto"
                  >
                    Abrir en CapCut &rarr;
                  </a>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
