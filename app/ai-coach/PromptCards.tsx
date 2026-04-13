'use client'

import { useState } from 'react'

const PROMPTS = [
  {
    emoji: '🎣',
    title: 'Hook viral',
    prompt: 'Dame 5 hooks virales para un video de TikTok GO sobre un hotel en Miami. Que enganchen en los primeros 2 segundos.',
  },
  {
    emoji: '✍️',
    title: 'Caption con hashtags',
    prompt: 'Escribe un caption para TikTok GO sobre una experiencia en un hotel. Incluye #tiktokgostay y 5 hashtags relevantes. Tono conversacional.',
  },
  {
    emoji: '🎙️',
    title: 'Voiceover 30 seg',
    prompt: 'Genera un voiceover de exactamente 30 segundos para un video de TikTok GO mostrando un hotel. Tono conversacional, como si le hablaras a una amiga.',
  },
  {
    emoji: '💡',
    title: 'Ideas de video',
    prompt: 'Dame 5 ideas creativas de videos para TikTok GO que puedo hacer en un hotel. Cada idea con un hook, concepto y duración sugerida.',
  },
]

export default function PromptCards() {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)

  async function handleCopy(idx: number, text: string) {
    await navigator.clipboard.writeText(text)
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 2000)
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {PROMPTS.map((p, idx) => (
        <div key={idx} className="bg-white border border-[rgba(255,119,0,0.1)] rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{p.emoji}</span>
            <h3 className="font-syne font-bold text-sm text-[#1a0800]">{p.title}</h3>
          </div>
          <p className="font-dm text-xs text-gray-500 leading-relaxed mb-3">{p.prompt}</p>
          <button
            onClick={() => handleCopy(idx, p.prompt)}
            className={`font-dm text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
              copiedIdx === idx
                ? 'bg-emerald-50 text-emerald-600'
                : 'bg-[#ff7700]/10 text-[#ff7700] hover:bg-[#ff7700]/20'
            }`}
          >
            {copiedIdx === idx ? '¡Copiado! ✓' : '📋 Copiar prompt'}
          </button>
        </div>
      ))}
    </div>
  )
}
