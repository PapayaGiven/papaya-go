'use client'
import { useState } from 'react'

export default function HashtagsCard({ hashtags }: { hashtags: string }) {
  const [copied, setCopied] = useState(false)

  // Parse: split by comma, clean, format as #tag
  const tags = hashtags.split(',').map(t => t.trim()).filter(Boolean).map(t => `#${t.replace(/^#/, '')}`)
  const copyText = tags.join(' ')

  async function handleCopy() {
    await navigator.clipboard.writeText(copyText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="bg-white border border-[rgba(255,119,0,0.1)] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-syne font-bold text-base border-l-[3px] border-[#ff7700] pl-3 text-gray-900">
          Tus hashtags
        </h2>
        <button
          onClick={handleCopy}
          className={`font-dm text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
            copied ? 'bg-emerald-50 text-emerald-600' : 'bg-[#ff7700]/10 text-[#ff7700] hover:bg-[#ff7700]/20'
          }`}
        >
          {copied ? '¡Copiado! ✓' : '📋 Copiar todos'}
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {tags.map(tag => (
          <span key={tag} className="font-dm text-sm font-semibold px-3 py-1 rounded-full bg-[#ff7700]/10 text-[#ff7700]">
            {tag}
          </span>
        ))}
      </div>
    </div>
  )
}
