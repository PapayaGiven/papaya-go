'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateOwnProfile } from '@/app/admin/actions'

/**
 * Creator-facing profile edit. Two fields only — full_name and
 * tiktok_handle. Posts to updateOwnProfile, which uses the user-
 * scoped Supabase client (auth.getUser() → match by email) so a
 * creator can't write to someone else's row even if they craft a
 * request manually.
 */
export function ProfileEditModal({
  initialName,
  initialHandle,
  onClose,
}: {
  initialName: string | null
  initialHandle: string | null
  onClose: () => void
}) {
  const [name, setName] = useState(initialName ?? '')
  const [handle, setHandle] = useState((initialHandle ?? '').replace(/^@+/, ''))
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleSave() {
    setFeedback(null)
    startTransition(async () => {
      const r = await updateOwnProfile({
        full_name: name,
        tiktok_handle: handle,
      })
      if (r.error) {
        setFeedback(`Error: ${r.error}`)
        return
      }
      setFeedback('✅ Perfil actualizado')
      // Refresh so the sidebar's name / @handle reflect the change.
      router.refresh()
      // Brief delay so the user sees the success toast before close.
      setTimeout(onClose, 800)
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden"
      >
        <header className="px-5 py-4 border-b border-go-border flex items-center justify-between">
          <h3 className="font-syne font-bold text-base text-go-dark">Editar perfil</h3>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="text-gray-400 hover:text-gray-700 text-xl leading-none disabled:opacity-40"
            aria-label="Cerrar"
          >
            ×
          </button>
        </header>

        <div className="p-5 space-y-4">
          <label className="block">
            <span className="block font-dm text-xs font-semibold text-go-dark/60 mb-1">
              Nombre completo
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-sm font-dm rounded-lg border border-go-border focus:outline-none focus:ring-2 focus:ring-go-orange/30"
            />
          </label>

          <label className="block">
            <span className="block font-dm text-xs font-semibold text-go-dark/60 mb-1">
              TikTok handle
            </span>
            <div className="flex items-center rounded-lg border border-go-border bg-white">
              <span className="px-3 text-go-orange font-dm text-sm select-none">@</span>
              <input
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value.replace(/^@+/, ''))}
                placeholder="tu_usuario"
                className="flex-1 px-2 py-2 text-sm font-dm bg-transparent outline-none"
              />
            </div>
          </label>

          {feedback && (
            <p
              className={`text-sm font-dm px-3 py-2 rounded-lg ${
                feedback.startsWith('Error')
                  ? 'bg-red-50 text-red-600'
                  : 'bg-emerald-50 text-emerald-700'
              }`}
            >
              {feedback}
            </p>
          )}
        </div>

        <footer className="px-5 py-4 border-t border-go-border flex items-center justify-end gap-2 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="font-dm text-sm font-semibold px-4 py-2 rounded-xl text-gray-500 hover:text-go-dark disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending || !name.trim()}
            className="font-dm text-sm font-semibold bg-go-orange text-white px-5 py-2 rounded-xl hover:bg-go-orange/90 transition disabled:opacity-50"
          >
            {isPending ? 'Guardando…' : 'Guardar'}
          </button>
        </footer>
      </div>
    </div>
  )
}
