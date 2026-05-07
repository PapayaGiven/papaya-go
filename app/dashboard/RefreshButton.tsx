'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

export default function RefreshButton() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [justRefreshed, setJustRefreshed] = useState(false)

  return (
    <button
      onClick={() => {
        startTransition(() => {
          router.refresh()
          setJustRefreshed(true)
          setTimeout(() => setJustRefreshed(false), 1500)
        })
      }}
      disabled={isPending}
      className="font-dm text-xs font-semibold text-go-dark/70 bg-go-dark/[0.04] hover:bg-go-dark/[0.08] px-3 py-1.5 rounded-full transition disabled:opacity-50"
    >
      {isPending ? 'Actualizando…' : justRefreshed ? '✓ Actualizado' : '🔄 Actualizar'}
    </button>
  )
}
