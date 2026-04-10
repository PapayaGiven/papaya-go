'use client'

import { useState } from 'react'

export default function DashboardHashtags({ tags }: { tags: string[] }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(tags.join(' '))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className={`font-dm text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
        copied ? 'bg-emerald-50 text-emerald-600' : 'bg-[#ff7700]/10 text-[#ff7700] hover:bg-[#ff7700]/20'
      }`}
    >
      {copied ? '¡Copiado! ✓' : '📋 Copiar hashtags'}
    </button>
  )
}
