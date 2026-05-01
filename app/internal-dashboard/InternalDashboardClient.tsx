'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { submitInternalVideo } from './actions'
import type { Creator, TikTokAccount, InternalVideo } from '@/lib/types'

interface Props {
  creator: Creator
  accounts: TikTokAccount[]
  videos: InternalVideo[]
  stats: { today: number; week: number; month: number }
}

function quotaState(count: number, quota: number): 'met' | 'progress' | 'behind' {
  if (quota <= 0) return 'progress'
  if (count >= quota) return 'met'
  if (count >= Math.ceil(quota / 2)) return 'progress'
  return 'behind'
}

function StatCard({ label, count, quota }: { label: string; count: number; quota: number }) {
  const state = quotaState(count, quota)
  const colors = {
    met: { ring: 'border-emerald-300', bg: 'bg-emerald-50', text: 'text-emerald-700', bar: 'bg-emerald-500' },
    progress: { ring: 'border-go-orange/40', bg: 'bg-go-orange/5', text: 'text-go-orange', bar: 'bg-go-orange' },
    behind: { ring: 'border-red-200', bg: 'bg-red-50', text: 'text-red-600', bar: 'bg-red-500' },
  }[state]
  const pct = quota > 0 ? Math.min((count / quota) * 100, 100) : 0
  return (
    <div className={`rounded-2xl border-2 ${colors.ring} ${colors.bg} p-5`}>
      <p className="font-dm text-xs uppercase tracking-wide text-go-dark/50">{label}</p>
      <p className={`font-syne font-bold text-4xl mt-1 ${colors.text}`}>{count}</p>
      <p className="font-dm text-xs text-go-dark/50 mt-1">
        <span className={`font-semibold ${colors.text}`}>{count}</span> / {quota || '—'} meta
      </p>
      <div className="mt-2 h-2 rounded-full bg-go-dark/10 overflow-hidden">
        <div className={`h-full ${colors.bar} transition-all`} style={{ width: `${pct}%` }} />
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
  const [tiktokUrl, setTiktokUrl] = useState('')
  const [videoType, setVideoType] = useState<'ACC' | 'TTD' | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!tiktokUrl.trim()) { setError('Pega el link de tu video'); return }
    if (!videoType) { setError('Selecciona ACC o TTD'); return }

    setLoading(true)
    try {
      const r = await submitInternalVideo({
        creator_id: creator.id,
        tiktok_account_id: accountId || null,
        tiktok_url: tiktokUrl.trim(),
        video_type: videoType,
      })
      if (r.error) setError(r.error)
      else {
        setSubmitted(true)
        setAccountId('')
        setTiktokUrl('')
        setVideoType(null)
        router.refresh()
        setTimeout(() => setSubmitted(false), 4000)
      }
    } finally {
      setLoading(false)
    }
  }

  const firstName = creator.full_name?.split(' ')[0] ?? 'Creadora'

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

        {/* Section 2 — Video counter */}
        <section>
          <h2 className="font-syne font-bold text-lg text-go-dark mb-3">📊 Tus videos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard label="Hoy" count={stats.today} quota={creator.daily_quota ?? 0} />
            <StatCard label="Esta semana" count={stats.week} quota={creator.weekly_quota ?? 0} />
            <StatCard label="Este mes" count={stats.month} quota={creator.monthly_quota ?? 0} />
          </div>
        </section>

        {/* Section 3 — Submit */}
        <section id="submit">
          <h2 className="font-syne font-bold text-lg text-go-dark mb-3">➕ Agregar video</h2>
          <div className="bg-white border border-go-orange/15 rounded-2xl p-5 shadow-sm">
            {submitted ? (
              <div className="text-center py-6">
                <p className="font-dm text-go-orange font-semibold text-lg">✅ Video enviado. El equipo lo verificará pronto.</p>
              </div>
            ) : (
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

                <div>
                  <label className="block font-dm text-sm font-medium text-go-dark mb-1">Pega el link de tu video</label>
                  <input
                    type="url"
                    value={tiktokUrl}
                    onChange={(e) => setTiktokUrl(e.target.value)}
                    placeholder="https://www.tiktok.com/@..."
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 font-dm text-sm text-go-dark placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-go-orange/30 focus:border-go-orange transition"
                  />
                </div>

                <div>
                  <label className="block font-dm text-sm font-medium text-go-dark mb-2">
                    Tipo de video <span className="text-go-orange">*</span>
                  </label>
                  <div className="flex gap-3">
                    {(['ACC', 'TTD'] as const).map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setVideoType(t)}
                        className={`flex-1 py-3 rounded-xl font-dm font-semibold text-sm transition-all border-2 ${
                          videoType === t
                            ? 'bg-go-orange text-white border-go-orange'
                            : 'bg-white text-go-dark/60 border-gray-200 hover:border-go-orange/40'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {error && <p className="font-dm text-sm text-red-500">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-go-orange hover:bg-go-orange/90 text-white font-dm font-semibold text-sm py-3 rounded-xl transition-all disabled:opacity-50"
                >
                  {loading ? 'Enviando...' : 'Enviar video →'}
                </button>
              </form>
            )}
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
