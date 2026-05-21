'use client'

import { useState, useTransition } from 'react'
import { updateCreator, updateCreatorNivel } from '@/app/admin/actions'
import { Creator, NIVEL_NAMES } from '@/lib/types'

/**
 * Admin "Editar" modal for go_creators rows. Eight editable fields
 * matching the spec — identity (name/email/handle), tier (nivel),
 * monthly counters (gmv/acc/ttd), and account status.
 *
 * Nivel changes go through updateCreatorNivel afterward so the
 * monthly-counter reset logic that already exists for level-up
 * events also fires here.
 */
export function CreatorEditModal({
  creator,
  onClose,
  onFeedback,
}: {
  creator: Creator
  onClose: () => void
  onFeedback: (msg: string) => void
}) {
  const [form, setForm] = useState({
    full_name: creator.full_name ?? '',
    email: creator.email ?? '',
    tiktok_handle: creator.tiktok_handle ?? '',
    nivel: creator.nivel,
    gmv_this_month: String(creator.gmv_this_month ?? 0),
    acc_this_month: String(creator.acc_this_month ?? 0),
    ttd_this_month: String(creator.ttd_this_month ?? 0),
    status: creator.status,
  })
  const [isPending, startTransition] = useTransition()

  // Strip a leading @ for the input display — admins paste handles
  // both ways and we want the value the field renders to match
  // what's stored (no @).
  function setHandle(raw: string) {
    setForm((f) => ({ ...f, tiktok_handle: raw.replace(/^@+/, '') }))
  }

  function handleSave() {
    const nivelChanged = creator.nivel !== form.nivel
    if (nivelChanged) {
      const ok = confirm(
        `¿Confirmas? Cambiar el nivel de ${creator.full_name ?? creator.email} reiniciará el contador de videos de este mes.`,
      )
      if (!ok) return
    }
    startTransition(async () => {
      const r = await updateCreator(creator.id, {
        full_name: form.full_name,
        email: form.email,
        tiktok_handle: form.tiktok_handle,
        nivel: form.nivel,
        gmv_this_month: Number(form.gmv_this_month) || 0,
        acc_this_month: Number(form.acc_this_month) || 0,
        ttd_this_month: Number(form.ttd_this_month) || 0,
        status: form.status,
      })
      if (r.error) {
        onFeedback(`Error: ${r.error}`)
        return
      }
      if (nivelChanged) {
        const r2 = await updateCreatorNivel(creator.id, form.nivel)
        if (r2.error) {
          onFeedback(`Error al cambiar nivel: ${r2.error}`)
          return
        }
      }
      onFeedback('✅ Creadora actualizada')
      onClose()
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
      >
        <header className="px-5 py-4 border-b border-go-border flex items-center justify-between">
          <h3 className="font-syne font-bold text-lg text-go-dark">Editar creadora</h3>
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
          <Field label="Nombre completo">
            <Input
              value={form.full_name}
              onChange={(v) => setForm({ ...form, full_name: v })}
            />
          </Field>

          <Field label="Email">
            <Input
              type="email"
              value={form.email}
              onChange={(v) => setForm({ ...form, email: v })}
            />
          </Field>

          <Field label="TikTok handle">
            <div className="flex items-center rounded-lg border border-go-border bg-white">
              <span className="px-3 text-go-orange font-dm text-sm select-none">@</span>
              <input
                type="text"
                value={form.tiktok_handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="usuario"
                className="flex-1 px-2 py-2 text-sm font-dm bg-transparent outline-none"
              />
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Nivel">
              <select
                value={form.nivel}
                onChange={(e) => setForm({ ...form, nivel: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm font-dm rounded-lg border border-go-border focus:outline-none focus:ring-2 focus:ring-go-orange/30"
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n} · {NIVEL_NAMES[n]}
                  </option>
                ))}
              </select>
              {form.nivel !== creator.nivel && (
                <p className="font-dm text-[11px] text-amber-700 mt-1">
                  ⚠️ Reiniciará contadores del mes.
                </p>
              )}
            </Field>

            <Field label="Status">
              <select
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as Creator['status'] })
                }
                className="w-full px-3 py-2 text-sm font-dm rounded-lg border border-go-border focus:outline-none focus:ring-2 focus:ring-go-orange/30"
              >
                <option value="pending">pending</option>
                <option value="active">active</option>
                <option value="suspended">suspended</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="GMV mes ($)">
              <Input
                type="number"
                value={form.gmv_this_month}
                onChange={(v) => setForm({ ...form, gmv_this_month: v })}
              />
            </Field>
            <Field label="ACC mes">
              <Input
                type="number"
                value={form.acc_this_month}
                onChange={(v) => setForm({ ...form, acc_this_month: v })}
              />
            </Field>
            <Field label="TTD mes">
              <Input
                type="number"
                value={form.ttd_this_month}
                onChange={(v) => setForm({ ...form, ttd_this_month: v })}
              />
            </Field>
          </div>
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
            disabled={isPending || !form.email || !form.full_name}
            className="font-dm text-sm font-semibold bg-go-orange text-white px-5 py-2 rounded-xl hover:bg-go-orange/90 transition disabled:opacity-50"
          >
            {isPending ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </footer>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block font-dm text-xs font-semibold text-go-dark/60 mb-1">{label}</span>
      {children}
    </label>
  )
}

function Input({
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 text-sm font-dm rounded-lg border border-go-border focus:outline-none focus:ring-2 focus:ring-go-orange/30"
    />
  )
}
