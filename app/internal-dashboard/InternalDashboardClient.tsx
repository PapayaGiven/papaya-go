'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { submitInternalVideosBatch } from './actions'
import type { Creator, TikTokAccount, InternalVideo } from '@/lib/types'

type Split = { acc: number; ttd: number; total: number }

interface Props {
  creator: Creator
  accounts: TikTokAccount[]
  videos: InternalVideo[]
  stats: { today: Split; week: Split; month: Split }
}

// A single row in the multi-link submission form. `key` is a stable client-side
// id so React can track rows across add/remove without remounting inputs.
type FormRow = {
  key: number
  tiktokUrl: string
  videoType: 'ACC' | 'TTD' | null
  error?: string
  duplicate?: boolean
}

let rowSeq = 0
const emptyRow = (): FormRow => ({ key: ++rowSeq, tiktokUrl: '', videoType: null })

function Badge({ value, label, tone }: { value: number; label: string; tone: 'acc' | 'ttd' | 'total' }) {
  const tones = {
    acc: 'bg-orange-100 text-orange-700',
    ttd: 'bg-pink-100 text-pink-700',
    total: 'bg-gray-100 text-gray-600',
  }[tone]
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-dm font-bold ${tones}`}>
      <span className="font-syne">{value}</span> {label}
    </span>
  )
}

// One time-window row (Hoy / Esta semana / Este mes) rendered as colored badges.
function BreakdownRow({ label, split }: { label: string; split: Split }) {
  return (
    <div className="bg-white border border-go-orange/15 rounded-2xl p-4">
      <p className="font-dm text-xs uppercase tracking-wide text-go-dark/50 mb-2">{label}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Badge value={split.acc} label="ACC" tone="acc" />
        <Badge value={split.ttd} label="TTD" tone="ttd" />
        <Badge value={split.total} label="total" tone="total" />
      </div>
    </div>
  )
}

function statusBadge(v: InternalVideo) {
  if (v.status === 'approved') {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-dm font-semibold bg-emerald-100 text-emerald-700">✅ Aprobado</span>
  }
  if (v.status === 'rejected') {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-dm font-semibold bg-red-100 text-red-700">❌ Rechazado</span>
  }
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-dm font-semibold bg-amber-100 text-amber-700">⏳ Pendiente</span>
}

export default function InternalDashboardClient({ creator, accounts, videos, stats }: Props) {
  const router = useRouter()
  const [accountId, setAccountId] = useState('')
  const [rows, setRows] = useState<FormRow[]>([emptyRow()])
  const [successMsg, setSuccessMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  function addRow() {
    setRows(prev => [...prev, emptyRow()])
  }

  function removeRow(key: number) {
    setRows(prev => (prev.length <= 1 ? prev : prev.filter(r => r.key !== key)))
  }

  function patchRow(key: number, patch: Partial<FormRow>) {
    setRows(prev => prev.map(r => (r.key === key ? { ...r, ...patch, error: undefined, duplicate: undefined } : r)))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSuccessMsg('')

    // Client-side: every row must have a URL and a type before we call the server.
    let hasClientError = false
    const validated = rows.map(r => {
      if (!r.tiktokUrl.trim()) { hasClientError = true; return { ...r, error: 'Pega el link de tu video', duplicate: false } }
      if (!r.videoType) { hasClientError = true; return { ...r, error: 'Selecciona ACC o TTD', duplicate: false } }
      return { ...r, error: undefined, duplicate: undefined }
    })
    if (hasClientError) { setRows(validated); return }

    setLoading(true)
    try {
      const { results, insertedCount } = await submitInternalVideosBatch(
        creator.id,
        rows.map(r => ({
          tiktok_url: r.tiktokUrl.trim(),
          video_type: r.videoType as 'ACC' | 'TTD',
          tiktok_account_id: accountId || null,
        }))
      )

      // Keep only the rows the server rejected, annotated with their error.
      const erroredRows: FormRow[] = rows
        .map((r, i) => ({ r, res: results[i] }))
        .filter(x => x.res?.error)
        .map(x => ({ ...x.r, error: x.res.error, duplicate: x.res.duplicate }))

      if (insertedCount > 0) {
        setSuccessMsg(`✅ ${insertedCount} ${insertedCount === 1 ? 'video agregado' : 'videos agregados'} correctamente`)
        router.refresh()
        setTimeout(() => setSuccessMsg(''), 5000)
      }

      // Success rows drop out; on a fully-clean submit we reset to one empty row.
      setRows(erroredRows.length > 0 ? erroredRows : [emptyRow()])
    } finally {
      setLoading(false)
    }
  }

  const firstName = creator.full_name?.split(' ')[0] ?? 'Creadora'
  const monthlyQuota = creator.monthly_quota ?? 0
  const monthPct = monthlyQuota > 0 ? Math.min((stats.month.total / monthlyQuota) * 100, 100) : 0

  return (
    <div className="min-h-screen bg-[#fff8f2] pb-24">
      {/* Header */}
      <header className="bg-go-dark sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <span className="font-dm text-xs text-white/40">Papaya GO</span>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="text-xs text-white/50 hover:text-white transition font-dm"
          >
            {signingOut ? 'Cerrando...' : 'Cerrar sesión'}
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-8">
        {/* Greeting */}
        <section>
          <h1 className="font-syne font-bold text-3xl text-go-dark">
            ¡Hola, {firstName}! 🧡
          </h1>
          <p className="font-dm text-sm text-go-dark/60 mt-1">Creadora Interna de Papaya GO</p>
        </section>

        {/* Section 1 — TikTok accounts */}
        <section>
          <h2 className="font-syne font-bold text-lg text-go-dark mb-3">📱 Cuentas que debes seguir</h2>
          {accounts.length === 0 ? (
            <p className="font-dm text-sm text-go-dark/40 text-center py-6 bg-white border border-go-orange/20 rounded-2xl">
              No hay cuentas configuradas todavía.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {accounts.map(a => (
                <div key={a.id} className="bg-white border-2 border-go-orange/30 rounded-2xl p-4 flex flex-col gap-2">
                  <p className="font-syne font-bold text-go-dark text-lg">@{a.tiktok_handle.replace(/^@/, '')}</p>
                  {a.notes && <p className="font-dm text-xs text-go-dark/50">{a.notes}</p>}
                  {a.tiktok_url ? (
                    <a
                      href={a.tiktok_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 text-center bg-go-orange hover:bg-go-orange/90 text-white font-dm font-semibold text-sm py-2.5 rounded-xl transition"
                    >
                      Ver cuenta →
                    </a>
                  ) : (
                    <span className="mt-1 text-center bg-go-dark/5 text-go-dark/40 font-dm text-sm py-2.5 rounded-xl">Sin URL</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Section 2 — Video breakdown (ACC / TTD / total) */}
        <section>
          <h2 className="font-syne font-bold text-lg text-go-dark mb-3">📊 Tus videos</h2>
          <div className="space-y-3">
            <BreakdownRow label="Hoy" split={stats.today} />
            <BreakdownRow label="Esta semana" split={stats.week} />

            {/* This month adds a quota progress bar */}
            <div className="bg-white border border-go-orange/15 rounded-2xl p-4">
              <p className="font-dm text-xs uppercase tracking-wide text-go-dark/50 mb-2">Este mes</p>
              <div className="flex flex-wrap items-center gap-2">
                <Badge value={stats.month.acc} label="ACC" tone="acc" />
                <Badge value={stats.month.ttd} label="TTD" tone="ttd" />
                <Badge value={stats.month.total} label="total" tone="total" />
              </div>
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-dm text-xs text-go-dark/50">Meta mensual</span>
                  <span className="font-dm text-xs font-semibold text-go-dark">
                    {stats.month.total} / {monthlyQuota || '—'}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-go-dark/10 overflow-hidden">
                  <div className="h-full bg-go-orange transition-all" style={{ width: `${monthPct}%` }} />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3 — Submit (multi-link) */}
        <section id="submit">
          <h2 className="font-syne font-bold text-lg text-go-dark mb-3">➕ Agregar videos</h2>
          <div className="bg-white border border-go-orange/15 rounded-2xl p-5 shadow-sm">
            {successMsg && (
              <div className="mb-4 text-center py-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <p className="font-dm text-emerald-700 font-semibold text-sm">{successMsg}</p>
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block font-dm text-sm font-medium text-go-dark mb-1">¿Para cuál cuenta?</label>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 font-dm text-sm text-go-dark bg-white focus:outline-none focus:ring-2 focus:ring-go-orange/30 focus:border-go-orange transition"
                >
                  <option value="">Selecciona una cuenta...</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>@{a.tiktok_handle.replace(/^@/, '')}</option>
                  ))}
                </select>
              </div>

              {/* One row per link */}
              <div className="space-y-3">
                {rows.map((row) => (
                  <div key={row.key} className="rounded-xl border border-gray-200 p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <input
                        type="url"
                        value={row.tiktokUrl}
                        onChange={(e) => patchRow(row.key, { tiktokUrl: e.target.value })}
                        placeholder="https://www.tiktok.com/@..."
                        className={`flex-1 min-w-0 border rounded-xl px-4 py-2.5 font-dm text-sm text-go-dark placeholder:text-gray-300 focus:outline-none focus:ring-2 transition ${
                          row.error
                            ? 'border-red-400 bg-red-50 focus:ring-red-300/40 focus:border-red-400'
                            : 'border-gray-200 focus:ring-go-orange/30 focus:border-go-orange'
                        }`}
                      />
                      <div className="flex gap-1 shrink-0">
                        {(['ACC', 'TTD'] as const).map(t => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => patchRow(row.key, { videoType: t })}
                            className={`px-3 py-2.5 rounded-xl font-dm font-semibold text-xs transition-all border-2 ${
                              row.videoType === t
                                ? 'bg-go-orange text-white border-go-orange'
                                : 'bg-white text-go-dark/60 border-gray-200 hover:border-go-orange/40'
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeRow(row.key)}
                        disabled={rows.length <= 1}
                        aria-label="Eliminar fila"
                        className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl text-go-dark/40 hover:text-red-500 hover:bg-red-50 transition disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-go-dark/40"
                      >
                        ✕
                      </button>
                    </div>
                    {row.error && <p className="font-dm text-xs text-red-500 pl-1">{row.error}</p>}
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addRow}
                className="w-full border-2 border-dashed border-go-orange/40 text-go-orange font-dm font-semibold text-sm py-2.5 rounded-xl hover:bg-go-orange/5 transition"
              >
                + Agregar otro video
              </button>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-go-orange hover:bg-go-orange/90 text-white font-dm font-semibold text-sm py-3 rounded-xl transition-all disabled:opacity-50"
              >
                {loading ? 'Enviando...' : rows.length > 1 ? `Enviar ${rows.length} videos →` : 'Enviar video →'}
              </button>
            </form>
          </div>
        </section>

        {/* Section 4 — My videos */}
        <section id="my-videos">
          <h2 className="font-syne font-bold text-lg text-go-dark mb-3">🎥 Mis videos enviados</h2>
          {videos.length === 0 ? (
            <p className="font-dm text-sm text-go-dark/40 text-center py-6 bg-white border border-go-orange/15 rounded-2xl">
              Aún no has enviado videos.
            </p>
          ) : (
            <div className="space-y-2">
              {videos.map(v => (
                <div key={v.id} className="bg-white border border-go-orange/15 rounded-2xl p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-dm text-xs text-go-dark/40">
                        {new Date(v.submitted_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {v.tiktok_account?.tiktok_handle && (
                          <span className="ml-2 text-go-orange">@{v.tiktok_account.tiktok_handle.replace(/^@/, '')}</span>
                        )}
                      </p>
                      <a href={v.tiktok_url} target="_blank" rel="noopener noreferrer" className="font-dm text-sm text-go-orange hover:underline truncate block">
                        {v.tiktok_url}
                      </a>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${v.video_type === 'ACC' ? 'bg-orange-100 text-orange-700' : 'bg-pink-100 text-pink-700'}`}>{v.video_type}</span>
                      {statusBadge(v)}
                    </div>
                  </div>
                  {v.status === 'rejected' && v.rejection_reason && (
                    <p className="font-dm text-xs text-red-600 mt-2 bg-red-50 px-3 py-2 rounded-lg">
                      Razón: {v.rejection_reason}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-go-orange/15">
        <div className="max-w-3xl mx-auto grid grid-cols-3 px-2 py-2">
          <a href="#top" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="flex flex-col items-center gap-0.5 py-2 font-dm text-xs text-go-dark/70 hover:text-go-orange transition">
            <span className="text-lg">🏠</span>
            Dashboard
          </a>
          <a href="#submit" onClick={(e) => { e.preventDefault(); document.getElementById('submit')?.scrollIntoView({ behavior: 'smooth' }) }} className="flex flex-col items-center gap-0.5 py-2 font-dm text-xs text-go-dark/70 hover:text-go-orange transition">
            <span className="text-lg">➕</span>
            Agregar
          </a>
          <a href="#my-videos" onClick={(e) => { e.preventDefault(); document.getElementById('my-videos')?.scrollIntoView({ behavior: 'smooth' }) }} className="flex flex-col items-center gap-0.5 py-2 font-dm text-xs text-go-dark/70 hover:text-go-orange transition">
            <span className="text-lg">📊</span>
            Mis videos
          </a>
        </div>
      </nav>
    </div>
  )
}
