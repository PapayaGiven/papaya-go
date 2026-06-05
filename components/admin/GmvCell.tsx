'use client'

import { useState, useTransition } from 'react'
import { updateCreatorGmv, updateCreatorGmvTotal } from '@/app/admin/actions'

/**
 * Inline-edit cell for a creator's GMV. `field` selects which column:
 * 'this_month' (default) → gmv_this_month (also nudges gmv_total),
 * 'total' → gmv_total (lifetime cumulative, admin correction). Click
 * the value to swap it for an input + ✓ / ✗ controls. Surfaces
 * success/error to the parent through `onFeedback` so the parent's
 * toast strip is the single source of truth for status messages.
 */
export function GmvCell({
  creatorId,
  value,
  onFeedback,
  align = 'left',
  field = 'this_month',
}: {
  creatorId: string
  value: number | null | undefined
  onFeedback?: (msg: string) => void
  align?: 'left' | 'right'
  field?: 'this_month' | 'total'
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<string>('')
  const [optimistic, setOptimistic] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()

  const display = optimistic ?? Number(value ?? 0)

  function start(e: React.MouseEvent) {
    e.stopPropagation()
    setDraft(String(Number(value ?? 0)))
    setEditing(true)
  }

  function cancel(e?: React.MouseEvent | React.KeyboardEvent) {
    e?.stopPropagation()
    setEditing(false)
    setDraft('')
  }

  function save(e?: React.MouseEvent | React.KeyboardEvent) {
    e?.stopPropagation()
    const parsed = Number(draft)
    if (!Number.isFinite(parsed) || parsed < 0) {
      onFeedback?.('Error: GMV inválido')
      return
    }
    // Optimistic: paint the new value immediately, roll back if the
    // server rejects.
    setOptimistic(parsed)
    setEditing(false)
    startTransition(async () => {
      const r = field === 'total'
        ? await updateCreatorGmvTotal(creatorId, parsed)
        : await updateCreatorGmv(creatorId, parsed)
      if (r.error) {
        setOptimistic(null)
        onFeedback?.(`Error: ${r.error}`)
        return
      }
      onFeedback?.(field === 'total' ? '✅ GMV total actualizado' : '✅ GMV actualizado')
      // Server revalidatePath('/admin') will refetch the page's data;
      // once the new prop comes in, our optimistic value matches and
      // can be cleared. Until then we keep showing the optimistic
      // number so the cell doesn't flicker back to the stale value.
    })
  }

  // When the prop catches up to our optimistic value, drop the
  // optimistic state so future external updates flow through cleanly.
  if (optimistic != null && Number(value ?? 0) === optimistic) {
    queueMicrotask(() => setOptimistic(null))
  }

  if (editing) {
    return (
      <div
        className="inline-flex items-center gap-1"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-go-dark/50 text-xs">$</span>
        <input
          type="number"
          min={0}
          step="any"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save(e)
            else if (e.key === 'Escape') cancel(e)
          }}
          className="w-24 text-sm font-medium px-2 py-1 rounded-lg border border-go-orange/40 focus:outline-none focus:ring-2 focus:ring-go-orange/30"
        />
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          aria-label="Guardar GMV"
          className="text-emerald-600 hover:text-emerald-800 disabled:opacity-40 text-sm font-bold w-6 h-6 inline-flex items-center justify-center"
        >✓</button>
        <button
          type="button"
          onClick={cancel}
          disabled={isPending}
          aria-label="Cancelar"
          className="text-red-500 hover:text-red-700 disabled:opacity-40 text-sm font-bold w-6 h-6 inline-flex items-center justify-center"
        >✗</button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={start}
      title={field === 'total' ? 'Click para editar GMV total' : 'Click para editar GMV'}
      className={`inline-flex items-baseline gap-0.5 font-dm text-sm text-go-dark hover:text-go-orange hover:underline decoration-dotted underline-offset-4 transition ${align === 'right' ? 'tabular-nums' : ''}`}
    >
      <span className="text-go-dark/40 text-xs">$</span>
      <span className="font-medium tabular-nums">{Math.round(display).toLocaleString('en-US')}</span>
      {isPending && (
        <span className="ml-1 inline-block w-2 h-2 rounded-full bg-go-orange/60 animate-pulse" aria-hidden />
      )}
    </button>
  )
}
