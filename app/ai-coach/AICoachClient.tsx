'use client'
import { useState } from 'react'

const CONTENT_TYPES = [
  { key: 'hook', label: '🎣 Hook' },
  { key: 'caption', label: '✍️ Caption' },
  { key: 'voiceover', label: '🎙️ Voiceover 30 seg' },
  { key: 'ideas', label: '💡 Ideas de video' },
] as const
type ContentType = (typeof CONTENT_TYPES)[number]['key']

export default function AICoachClient() {
  const [url, setUrl] = useState('')
  const [placeName, setPlaceName] = useState('')
  const [contentType, setContentType] = useState<ContentType | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const canGenerate = contentType && (url.trim() || placeName.trim())

  async function handleGenerate() {
    if (!canGenerate) return

    setLoading(true)
    setError(null)
    setResult(null)
    setCopied(false)

    try {
      const res = await fetch('/api/ai-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          place_name: placeName,
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

  return (
    <div className="space-y-8">
      {/* Step 1: URL */}
      <div className="bg-white rounded-2xl border border-[rgba(255,119,0,0.12)] p-6">
        <h2 className="font-syne font-bold text-lg text-go-dark mb-1">
          1. Pega el link del lugar
        </h2>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.tiktokgostay.com/..."
          className="input-field font-dm"
        />
      </div>

      {/* Step 2: Place name */}
      <div className="bg-white rounded-2xl border border-[rgba(255,119,0,0.12)] p-6">
        <h2 className="font-syne font-bold text-lg text-go-dark mb-1">
          2. Nombre del lugar (opcional)
        </h2>
        <input
          type="text"
          value={placeName}
          onChange={(e) => setPlaceName(e.target.value)}
          placeholder="Ej: The Ritz-Carlton Miami"
          className="input-field font-dm"
        />
      </div>

      {/* Step 3: Content type */}
      <div className="bg-white rounded-2xl border border-[rgba(255,119,0,0.12)] p-6">
        <h2 className="font-syne font-bold text-lg text-go-dark mb-1">
          3. Tipo de contenido
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          {CONTENT_TYPES.map((ct) => (
            <button
              key={ct.key}
              onClick={() => setContentType(ct.key)}
              className={`font-dm text-sm font-medium px-4 py-3 rounded-xl border transition text-center ${
                contentType === ct.key
                  ? 'bg-go-orange text-white border-go-orange'
                  : 'bg-white text-gray-600 border-[rgba(255,119,0,0.12)] hover:border-go-orange hover:text-go-orange'
              }`}
            >
              {ct.label}
            </button>
          ))}
        </div>
      </div>

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={!canGenerate || loading}
        className="w-full py-3.5 rounded-xl font-dm font-semibold text-sm text-white bg-go-orange hover:bg-go-orange/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Generando...
          </span>
        ) : (
          'Generar con AI Coach'
        )}
      </button>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <p className="text-sm font-dm text-red-600">{error}</p>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="bg-white rounded-2xl border border-[rgba(255,119,0,0.12)] p-6">
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
                    : 'bg-white text-gray-600 border-[rgba(255,119,0,0.12)] hover:border-go-orange hover:text-go-orange'
                }`}
              >
                {copied ? '¡Copiado! ✓' : '📋 Copiar'}
              </button>
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="font-dm text-sm font-medium px-4 py-2 rounded-xl border border-[rgba(255,119,0,0.12)] bg-white text-gray-600 hover:border-go-orange hover:text-go-orange transition disabled:opacity-50"
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
    </div>
  )
}
