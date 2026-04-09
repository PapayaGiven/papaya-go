'use client'

import { useState } from 'react'
import { submitPortfolio } from './actions'

export default function PortfolioForm() {
  const [videoCount, setVideoCount] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
    setSubmitting(true)
    setError(null)
    const result = await submitPortfolio(formData)
    if (result?.error) {
      setError(result.error)
      setSubmitting(false)
    }
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      <div>
        <label
          htmlFor="media_kit_url"
          className="block font-dm text-sm font-medium text-gray-700 mb-1.5"
        >
          URL de tu Media Kit
        </label>
        <input
          id="media_kit_url"
          name="media_kit_url"
          type="url"
          placeholder="https://drive.google.com/..."
          className="w-full px-4 py-2.5 rounded-xl border border-go-border font-dm text-sm text-go-dark placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-go-orange/30 focus:border-go-orange transition"
        />
        <p className="font-dm text-xs text-gray-400 mt-1">
          Enlace a Google Drive, Canva, o similar (opcional)
        </p>
      </div>

      <div>
        <label
          htmlFor="stats_screenshot_url"
          className="block font-dm text-sm font-medium text-gray-700 mb-1.5"
        >
          URL de screenshot de tus stats
        </label>
        <input
          id="stats_screenshot_url"
          name="stats_screenshot_url"
          type="url"
          placeholder="https://imgur.com/..."
          className="w-full px-4 py-2.5 rounded-xl border border-go-border font-dm text-sm text-go-dark placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-go-orange/30 focus:border-go-orange transition"
        />
        <p className="font-dm text-xs text-gray-400 mt-1">
          Captura de pantalla de tu TikTok Analytics (opcional)
        </p>
      </div>

      <div>
        <p className="block font-dm text-sm font-medium text-gray-700 mb-1.5">
          Enlaces a tus mejores videos de TikTok
        </p>
        <div className="space-y-2">
          {Array.from({ length: videoCount }).map((_, i) => (
            <input
              key={i}
              name={`video_${i}`}
              type="url"
              placeholder={`https://www.tiktok.com/@tu_usuario/video/...`}
              className="w-full px-4 py-2.5 rounded-xl border border-go-border font-dm text-sm text-go-dark placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-go-orange/30 focus:border-go-orange transition"
            />
          ))}
        </div>
        {videoCount < 5 && (
          <button
            type="button"
            onClick={() => setVideoCount((c) => Math.min(c + 1, 5))}
            className="font-dm text-xs text-go-orange font-semibold mt-2 hover:underline"
          >
            + Agregar otro video
          </button>
        )}
        <p className="font-dm text-xs text-gray-400 mt-1">
          Agrega de 1 a 5 enlaces de TikTok
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <p className="font-dm text-sm text-red-600">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full sm:w-auto px-8 py-3 rounded-xl font-dm text-sm font-semibold text-white bg-go-orange hover:bg-go-orange/90 transition disabled:opacity-60"
      >
        {submitting ? 'Enviando...' : 'Enviar Portfolio'}
      </button>
    </form>
  )
}
