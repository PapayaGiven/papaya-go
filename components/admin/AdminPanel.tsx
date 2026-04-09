'use client'

import { useState, useTransition } from 'react'
import type {
  Creator,
  POI,
  CapCutTemplate,
  Announcement,
  PortfolioSubmission,
  NivelReward,
  BoostRequest,
  RewardRequest,
} from '@/lib/types'
import { NIVEL_NAMES, POI_TYPE_LABELS } from '@/lib/types'
import {
  adminLogout,
  approveCreator,
  updateCreator,
  addCreator,
  deleteCreator,
  updateCreatorStrategy,
  addPOI,
  // updatePOI,
  togglePOI,
  deletePOI,
  addTemplate,
  deleteTemplate,
  setAnnouncement,
  toggleAnnouncement,
  updatePortfolioStatus,
  addViralVideo,
  toggleViralVideo,
  deleteViralVideo,
  syncViralVideosFromSheet,
  updatePOIRequestStatus,
  updatePOITimesSold,
  addNivelReward,
  toggleNivelReward,
  deleteNivelReward,
  updateBoostStatus,
  updateRewardRequestStatus,
} from '@/app/admin/actions'

// ── Types ─────────────────────────────────────────────

interface ViralVideo {
  id: string
  tiktok_url: string
  tiktok_handle: string | null
  views: string | null
  video_type: string | null
  is_active: boolean
  created_at: string
}

interface POIRequest {
  id: string
  creator_id: string
  creator_name: string | null
  tiktok_handle: string | null
  place_name: string
  city_state: string | null
  place_type: string | null
  reason: string | null
  status: string
  created_at: string
  creator?: { full_name: string | null; email: string } | null
}

type Tab = 'creators' | 'pois' | 'templates' | 'announcements' | 'portfolios' | 'viral' | 'poi-requests' | 'rewards-admin' | 'boosts' | 'reward-requests'

interface AdminPanelProps {
  creators: Creator[]
  pois: POI[]
  templates: CapCutTemplate[]
  announcements: Announcement[]
  portfolios: PortfolioSubmission[]
  viralVideos: ViralVideo[]
  poiRequests: POIRequest[]
  nivelRewards: NivelReward[]
  boostRequests: BoostRequest[]
  rewardRequests: RewardRequest[]
}

// ── Shared helpers ────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    active: 'bg-emerald-100 text-emerald-800',
    suspended: 'bg-red-100 text-red-800',
    reviewed: 'bg-blue-100 text-blue-800',
    pitched: 'bg-purple-100 text-purple-800',
  }
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] ?? 'bg-gray-100 text-gray-700'}`}
    >
      {status}
    </span>
  )
}

function ActionButton({
  onClick,
  variant = 'primary',
  disabled,
  children,
}: {
  onClick: () => void
  variant?: 'primary' | 'danger' | 'ghost'
  disabled?: boolean
  children: React.ReactNode
}) {
  const base = 'px-3 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-40'
  const variants: Record<string, string> = {
    primary: 'bg-go-orange text-white hover:bg-go-orange/90',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'bg-go-light text-go-dark border border-go-border hover:bg-go-border',
  }
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${variants[variant]}`}>
      {children}
    </button>
  )
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-go-border shadow-sm overflow-hidden">
      {children}
    </div>
  )
}

function FormInput({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  required,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  required?: boolean
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-go-dark/60 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full px-3 py-2 rounded-lg border border-go-border bg-go-light text-sm font-dm text-go-dark focus:outline-none focus:ring-2 focus:ring-go-orange/30 focus:border-go-orange transition"
      />
    </div>
  )
}

function FormSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-go-dark/60 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-go-border bg-go-light text-sm font-dm text-go-dark focus:outline-none focus:ring-2 focus:ring-go-orange/30 focus:border-go-orange transition"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

// ── Viral Videos Tab ─────────────────────────────────

function ViralVideosTab({ videos, startTransition }: { videos: ViralVideo[]; startTransition: (fn: () => void) => void }) {
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ tiktok_url: '', video_type: 'ACC' })
  const [feedback, setFeedback] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)

  function fb(msg: string) { setFeedback(msg); setTimeout(() => setFeedback(null), 5000) }

  return (
    <SectionCard>
      <div className="p-6">
      <h2 className="font-syne font-bold text-lg text-go-dark mb-4">Videos Virales ({videos.length})</h2>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => setShowAdd(!showAdd)} className="font-dm text-sm font-semibold bg-go-orange text-white px-4 py-2 rounded-xl hover:bg-go-orange/90 transition">
          {showAdd ? 'Cancelar' : '+ Agregar video'}
        </button>
        <button
          disabled={syncing}
          onClick={() => {
            setSyncing(true)
            startTransition(async () => {
              const r = await syncViralVideosFromSheet()
              if (r.error) fb(`Error: ${r.error}`)
              else fb(`✓ ${r.count} videos sincronizados desde Google Sheets`)
              setSyncing(false)
            })
          }}
          className="font-dm text-sm font-semibold bg-emerald-600 text-white px-4 py-2 rounded-xl hover:bg-emerald-700 transition disabled:opacity-50"
        >
          {syncing ? 'Sincronizando...' : '📊 Sync desde Google Sheets'}
        </button>
      </div>

      {feedback && <p className={`text-sm font-dm mb-3 px-3 py-2 rounded-lg ${feedback.startsWith('Error') ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>{feedback}</p>}

      {showAdd && (
        <div className="bg-go-light border border-go-border rounded-2xl p-5 mb-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <input placeholder="URL de TikTok" value={form.tiktok_url} onChange={e => setForm(f => ({ ...f, tiktok_url: e.target.value }))} className="input-field sm:col-span-2" />
            <select value={form.video_type} onChange={e => setForm(f => ({ ...f, video_type: e.target.value }))} className="input-field">
              <option value="ACC">ACC (Hotel)</option>
              <option value="TTD">TTD (Atracción)</option>
            </select>
          </div>
          <button disabled={!form.tiktok_url} onClick={() => startTransition(async () => {
            const r = await addViralVideo(form)
            if (r.error) fb(`Error: ${r.error}`)
            else { fb('✓ Video agregado'); setForm({ tiktok_url: '', video_type: 'ACC' }); setShowAdd(false) }
          })} className="mt-3 font-dm text-sm font-semibold bg-go-orange text-white px-5 py-2.5 rounded-xl hover:bg-go-orange/90 transition disabled:opacity-50">
            Guardar
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-go-dark/5">
        <table className="w-full text-sm font-dm">
          <thead className="bg-go-dark/[0.03]">
            <tr>
              {['URL', 'Tipo', 'Activo', 'Acciones'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs text-go-dark/50 font-semibold uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-go-dark/5">
            {videos.map(v => (
              <tr key={v.id}>
                <td className="px-4 py-3 font-medium text-go-dark max-w-[250px]">
                  <a href={v.tiktok_url} target="_blank" rel="noopener noreferrer" className="hover:text-go-orange hover:underline text-xs truncate block">{v.tiktok_url}</a>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${v.video_type === 'ACC' ? 'bg-go-orange/10 text-go-orange' : 'bg-go-pink/20 text-pink-700'}`}>{v.video_type}</span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => startTransition(async () => { await toggleViralVideo(v.id, !v.is_active); fb('✓') })} className={`text-xs font-semibold px-2.5 py-1 rounded-full ${v.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
                    {v.is_active ? 'Activo' : 'Inactivo'}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => { if (confirm('¿Eliminar?')) startTransition(async () => { await deleteViralVideo(v.id); fb('✓ Eliminado') }) }} className="text-xs text-red-400 hover:text-red-600">Eliminar</button>
                </td>
              </tr>
            ))}
            {videos.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-go-dark/40">No hay videos virales.</td></tr>}
          </tbody>
        </table>
      </div>
      </div>
    </SectionCard>
  )
}

// ── POI Requests Tab ─────────────────────────────────

function POIRequestsTab({ requests, startTransition }: { requests: POIRequest[]; startTransition: (fn: () => void) => void }) {
  const [feedback, setFeedback] = useState<string | null>(null)
  function fb(msg: string) { setFeedback(msg); setTimeout(() => setFeedback(null), 5000) }

  return (
    <SectionCard>
      <div className="p-6">
        <h2 className="font-syne font-bold text-lg text-go-dark mb-4">Solicitudes de POI ({requests.length})</h2>

        {feedback && <p className={`text-sm font-dm mb-3 px-3 py-2 rounded-lg ${feedback.startsWith('Error') ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>{feedback}</p>}

        <div className="overflow-x-auto rounded-2xl border border-go-dark/5">
          <table className="w-full text-sm font-dm">
            <thead className="bg-go-dark/[0.03]">
              <tr>
                {['Creator', 'TikTok', 'Lugar', 'Ciudad', 'Tipo', 'Razon', 'Estado', 'Fecha'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs text-go-dark/50 font-semibold uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-go-dark/5">
              {requests.map(r => (
                <tr key={r.id} className={r.status === 'conseguido' ? 'bg-emerald-50' : ''}>
                  <td className="px-4 py-3 font-medium text-go-dark">
                    {r.creator?.full_name ?? r.creator_name ?? '—'}
                    {r.creator?.email && <span className="block text-xs text-go-dark/40">{r.creator.email}</span>}
                  </td>
                  <td className="px-4 py-3 text-go-dark/60 text-xs">{r.tiktok_handle ?? '—'}</td>
                  <td className="px-4 py-3 font-medium text-go-dark">{r.place_name}</td>
                  <td className="px-4 py-3 text-go-dark/60 text-xs">{r.city_state ?? '—'}</td>
                  <td className="px-4 py-3 text-go-dark/60 text-xs">{r.place_type ?? '—'}</td>
                  <td className="px-4 py-3 text-go-dark/50 text-xs max-w-[200px] truncate">{r.reason ?? '—'}</td>
                  <td className="px-4 py-3">
                    <select
                      value={r.status}
                      onChange={(e) => {
                        startTransition(async () => {
                          const res = await updatePOIRequestStatus(r.id, e.target.value)
                          if (res.error) fb(`Error: ${res.error}`)
                          else fb('Estado actualizado')
                        })
                      }}
                      className="text-xs px-2 py-1 rounded-lg border border-go-border bg-go-light font-dm text-go-dark focus:outline-none focus:ring-2 focus:ring-go-orange/30 focus:border-go-orange transition"
                    >
                      {['pending', 'en proceso', 'conseguido', 'rechazado'].map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-go-dark/40 text-xs">{new Date(r.created_at).toLocaleDateString('es')}</td>
                </tr>
              ))}
              {requests.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-go-dark/40">No hay solicitudes de POI.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </SectionCard>
  )
}

// ── Nivel Rewards Tab ────────────────────────────────

function NivelRewardsTab({ rewards, startTransition }: { rewards: NivelReward[]; startTransition: (fn: () => void) => void }) {
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ nivel: '1', reward_name: '', reward_description: '', reward_emoji: '🎁' })
  const [feedback, setFeedback] = useState<string | null>(null)
  function fb(msg: string) { setFeedback(msg); setTimeout(() => setFeedback(null), 5000) }

  const grouped = [1, 2, 3, 4].map(n => ({ nivel: n, items: rewards.filter(r => r.nivel === n) }))

  return (
    <SectionCard>
      <div className="p-6">
        <h2 className="font-syne font-bold text-lg text-go-dark mb-4">Rewards por Nivel ({rewards.length})</h2>

        <button onClick={() => setShowAdd(!showAdd)} className="font-dm text-sm font-semibold bg-go-orange text-white px-4 py-2 rounded-xl hover:bg-go-orange/90 transition mb-4">
          {showAdd ? 'Cancelar' : '+ Agregar Reward'}
        </button>

        {feedback && <p className={`text-sm font-dm mb-3 px-3 py-2 rounded-lg ${feedback.startsWith('Error') ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>{feedback}</p>}

        {showAdd && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              startTransition(async () => {
                const res = await addNivelReward({
                  nivel: parseInt(form.nivel),
                  reward_name: form.reward_name,
                  reward_description: form.reward_description || null,
                  reward_emoji: form.reward_emoji,
                })
                if (res.error) fb(`Error: ${res.error}`)
                else { fb('Reward agregado'); setForm({ nivel: '1', reward_name: '', reward_description: '', reward_emoji: '🎁' }); setShowAdd(false) }
              })
            }}
            className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-6 p-4 bg-go-light rounded-xl border border-go-border"
          >
            <FormSelect label="Nivel" value={form.nivel} onChange={(v) => setForm({ ...form, nivel: v })} options={[
              { value: '1', label: '1 - Explorer' },
              { value: '2', label: '2 - Contributor' },
              { value: '3', label: '3 - Partner' },
              { value: '4', label: '4 - Elite' },
            ]} />
            <FormInput label="Nombre" value={form.reward_name} onChange={(v) => setForm({ ...form, reward_name: v })} required />
            <FormInput label="Descripcion" value={form.reward_description} onChange={(v) => setForm({ ...form, reward_description: v })} />
            <div className="flex items-end gap-2">
              <FormInput label="Emoji" value={form.reward_emoji} onChange={(v) => setForm({ ...form, reward_emoji: v })} />
              <ActionButton onClick={() => {}} variant="primary">Guardar</ActionButton>
            </div>
          </form>
        )}

        {grouped.map(g => (
          <div key={g.nivel} className="mb-6">
            <h3 className="font-syne font-bold text-sm text-go-dark/70 mb-2">Nivel {g.nivel} — {NIVEL_NAMES[g.nivel]}</h3>
            <div className="overflow-x-auto rounded-2xl border border-go-dark/5">
              <table className="w-full text-sm font-dm">
                <thead className="bg-go-dark/[0.03]">
                  <tr>
                    {['Emoji', 'Nombre', 'Descripcion', 'Activo', 'Acciones'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs text-go-dark/50 font-semibold uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-go-dark/5">
                  {g.items.map(r => (
                    <tr key={r.id} className={!r.is_active ? 'opacity-40' : ''}>
                      <td className="px-4 py-3 text-lg">{r.reward_emoji}</td>
                      <td className="px-4 py-3 font-medium text-go-dark">{r.reward_name}</td>
                      <td className="px-4 py-3 text-go-dark/60 text-xs">{r.reward_description ?? '—'}</td>
                      <td className="px-4 py-3">
                        <ActionButton onClick={() => startTransition(async () => {
                          const res = await toggleNivelReward(r.id, !r.is_active)
                          if (res.error) fb(`Error: ${res.error}`)
                          else fb(r.is_active ? 'Desactivado' : 'Activado')
                        })} variant="ghost">
                          {r.is_active ? 'Desactivar' : 'Activar'}
                        </ActionButton>
                      </td>
                      <td className="px-4 py-3">
                        <ActionButton onClick={() => startTransition(async () => {
                          await deleteNivelReward(r.id)
                          fb('Reward eliminado')
                        })} variant="danger">
                          Eliminar
                        </ActionButton>
                      </td>
                    </tr>
                  ))}
                  {g.items.length === 0 && <tr><td colSpan={5} className="px-4 py-4 text-center text-go-dark/40 text-xs">Sin rewards para este nivel.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}

// ── Boosts Tab ──────────────────────────────────────

function BoostsTab({ boosts, startTransition }: { boosts: BoostRequest[]; startTransition: (fn: () => void) => void }) {
  const [feedback, setFeedback] = useState<string | null>(null)
  function fb(msg: string) { setFeedback(msg); setTimeout(() => setFeedback(null), 5000) }

  return (
    <SectionCard>
      <div className="p-6">
        <h2 className="font-syne font-bold text-lg text-go-dark mb-4">Solicitudes de Boost ({boosts.length})</h2>

        {feedback && <p className={`text-sm font-dm mb-3 px-3 py-2 rounded-lg ${feedback.startsWith('Error') ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>{feedback}</p>}

        <div className="overflow-x-auto rounded-2xl border border-go-dark/5">
          <table className="w-full text-sm font-dm">
            <thead className="bg-go-dark/[0.03]">
              <tr>
                {['Creator', 'TikTok', 'URL Video', 'Razon', 'Notas', 'Estado', 'Fecha'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs text-go-dark/50 font-semibold uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-go-dark/5">
              {boosts.map(b => (
                <tr key={b.id} className={b.status === 'boosteado' ? 'bg-emerald-50' : ''}>
                  <td className="px-4 py-3 font-medium text-go-dark">{b.creator_name ?? '—'}</td>
                  <td className="px-4 py-3 text-go-dark/60 text-xs">{b.tiktok_handle ?? '—'}</td>
                  <td className="px-4 py-3 text-xs">
                    {(b.tiktok_url || b.video_url) ? (
                      <a href={b.tiktok_url || b.video_url || '#'} target="_blank" rel="noopener noreferrer" className="text-go-orange hover:underline truncate block max-w-[180px]">
                        {b.tiktok_url || b.video_url}
                      </a>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-go-dark/50 text-xs max-w-[200px] truncate">{b.boost_reason ?? '—'}</td>
                  <td className="px-4 py-3 text-go-dark/50 text-xs max-w-[150px] truncate">{b.notes ?? '—'}</td>
                  <td className="px-4 py-3">
                    <select
                      value={b.status}
                      onChange={(e) => {
                        startTransition(async () => {
                          const res = await updateBoostStatus(b.id, e.target.value)
                          if (res.error) fb(`Error: ${res.error}`)
                          else fb('Estado actualizado')
                        })
                      }}
                      className="text-xs px-2 py-1 rounded-lg border border-go-border bg-go-light font-dm text-go-dark focus:outline-none focus:ring-2 focus:ring-go-orange/30 focus:border-go-orange transition"
                    >
                      {['pending', 'en proceso', 'boosteado'].map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-go-dark/40 text-xs">{new Date(b.created_at).toLocaleDateString('es')}</td>
                </tr>
              ))}
              {boosts.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-go-dark/40">No hay solicitudes de boost.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </SectionCard>
  )
}

// ── Reward Requests Tab ─────────────────────────────

function RewardRequestsTab({ requests, startTransition }: { requests: RewardRequest[]; startTransition: (fn: () => void) => void }) {
  const [feedback, setFeedback] = useState<string | null>(null)
  function fb(msg: string) { setFeedback(msg); setTimeout(() => setFeedback(null), 5000) }

  return (
    <SectionCard>
      <div className="p-6">
        <h2 className="font-syne font-bold text-lg text-go-dark mb-4">Solicitudes de Reward ({requests.length})</h2>

        {feedback && <p className={`text-sm font-dm mb-3 px-3 py-2 rounded-lg ${feedback.startsWith('Error') ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>{feedback}</p>}

        <div className="overflow-x-auto rounded-2xl border border-go-dark/5">
          <table className="w-full text-sm font-dm">
            <thead className="bg-go-dark/[0.03]">
              <tr>
                {['Creator', 'Nivel', 'Reward', 'Notas', 'Estado', 'Fecha'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs text-go-dark/50 font-semibold uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-go-dark/5">
              {requests.map(r => (
                <tr key={r.id} className={r.status === 'entregado' ? 'bg-emerald-50' : ''}>
                  <td className="px-4 py-3 font-medium text-go-dark">
                    {r.creator_name ?? '—'}
                    {r.tiktok_handle && <span className="block text-xs text-go-dark/40">@{r.tiktok_handle}</span>}
                  </td>
                  <td className="px-4 py-3 text-go-dark/60 text-xs">{r.nivel} — {NIVEL_NAMES[r.nivel] ?? ''}</td>
                  <td className="px-4 py-3 font-medium text-go-dark">{r.reward_name}</td>
                  <td className="px-4 py-3 text-go-dark/50 text-xs max-w-[200px] truncate">{r.notes ?? '—'}</td>
                  <td className="px-4 py-3">
                    <select
                      value={r.status}
                      onChange={(e) => {
                        startTransition(async () => {
                          const res = await updateRewardRequestStatus(r.id, e.target.value)
                          if (res.error) fb(`Error: ${res.error}`)
                          else fb('Estado actualizado')
                        })
                      }}
                      className="text-xs px-2 py-1 rounded-lg border border-go-border bg-go-light font-dm text-go-dark focus:outline-none focus:ring-2 focus:ring-go-orange/30 focus:border-go-orange transition"
                    >
                      {['pending', 'en proceso', 'entregado'].map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-go-dark/40 text-xs">{new Date(r.created_at).toLocaleDateString('es')}</td>
                </tr>
              ))}
              {requests.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-go-dark/40">No hay solicitudes de reward.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </SectionCard>
  )
}

// ── Main Component ────────────────────────────────────

export default function AdminPanel({
  creators,
  pois,
  templates,
  announcements,
  portfolios,
  viralVideos,
  poiRequests,
  nivelRewards,
  boostRequests,
  rewardRequests,
}: AdminPanelProps) {
  const [tab, setTab] = useState<Tab>('creators')
  const [isPending, startTransition] = useTransition()

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'creators', label: 'Creators', count: creators.length },
    { key: 'pois', label: 'POIs', count: pois.length },
    { key: 'templates', label: 'CapCut Templates', count: templates.length },
    { key: 'announcements', label: 'Announcements', count: announcements.length },
    { key: 'portfolios', label: 'Portfolios', count: portfolios.length },
    { key: 'viral', label: 'Videos Virales', count: viralVideos.length },
    { key: 'poi-requests', label: 'Solicitudes', count: poiRequests.length },
    { key: 'rewards-admin', label: '🎁 Rewards', count: nivelRewards.length },
    { key: 'boosts', label: '🚀 Boosts', count: boostRequests.length },
    { key: 'reward-requests', label: '🎀 Reward Requests', count: rewardRequests.length },
  ]

  return (
    <div className="min-h-screen bg-go-light font-dm">
      {/* Header */}
      <header className="bg-go-dark sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="https://mmhsulgcowhqimypglul.supabase.co/storage/v1/object/public/PGLOGOS/Papaya%20Go%20Logo.png" alt="Papaya GO" className="h-8 object-contain" />
            <span className="text-xs text-white/40 font-dm">Admin</span>
          </div>
          <button
            onClick={() => startTransition(() => adminLogout())}
            className="text-xs text-white/50 hover:text-white transition font-dm"
          >
            Cerrar sesion
          </button>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-1 overflow-x-auto pb-px">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap rounded-t-lg transition ${
                tab === t.key
                  ? 'bg-go-light text-go-dark'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/5'
              }`}
            >
              {t.label}
              <span
                className={`ml-1.5 text-xs ${tab === t.key ? 'text-go-orange' : 'text-white/30'}`}
              >
                {t.count}
              </span>
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {isPending && (
          <div className="mb-4 px-4 py-2 bg-go-orange/10 text-go-orange text-sm rounded-lg font-dm">
            Actualizando...
          </div>
        )}

        {tab === 'creators' && (
          <CreatorsTab creators={creators} startTransition={startTransition} />
        )}
        {tab === 'pois' && <POIsTab pois={pois} startTransition={startTransition} />}
        {tab === 'templates' && (
          <TemplatesTab templates={templates} startTransition={startTransition} />
        )}
        {tab === 'announcements' && (
          <AnnouncementsTab announcements={announcements} startTransition={startTransition} />
        )}
        {tab === 'portfolios' && (
          <PortfoliosTab portfolios={portfolios} startTransition={startTransition} />
        )}
        {tab === 'viral' && (
          <ViralVideosTab videos={viralVideos} startTransition={startTransition} />
        )}
        {tab === 'poi-requests' && (
          <POIRequestsTab requests={poiRequests} startTransition={startTransition} />
        )}
        {tab === 'rewards-admin' && <NivelRewardsTab rewards={nivelRewards} startTransition={startTransition} />}
        {tab === 'boosts' && <BoostsTab boosts={boostRequests} startTransition={startTransition} />}
        {tab === 'reward-requests' && <RewardRequestsTab requests={rewardRequests} startTransition={startTransition} />}
      </main>
    </div>
  )
}

// ── Creators Tab ──────────────────────────────────────

function CreatorsTab({
  creators,
  startTransition,
}: {
  creators: Creator[]
  startTransition: (cb: () => void) => void
}) {
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editData, setEditData] = useState<Record<string, string | number>>({})
  const [feedback, setFeedback] = useState<string | null>(null)
  const fb = (msg: string) => { setFeedback(msg); setTimeout(() => setFeedback(null), 5000) }
  const [strategyId, setStrategyId] = useState<string | null>(null)
  const [strategyForm, setStrategyForm] = useState({ acc_goal: '', ttd_goal: '', gmv_goal: '', special_hashtags: '', creative_brief: '' })

  // Add form state
  const [newEmail, setNewEmail] = useState('')
  const [newName, setNewName] = useState('')
  const [newTiktok, setNewTiktok] = useState('')

  function startEdit(c: Creator) {
    setEditId(c.id)
    setEditData({
      nivel: c.nivel,
      gmv_total: c.gmv_total,
      acc_this_month: c.acc_this_month,
      ttd_this_month: c.ttd_this_month,
      videos_this_month: c.videos_this_month,
      status: c.status,
    })
  }

  function saveEdit(id: string) {
    startTransition(async () => {
      await updateCreator(id, {
        nivel: Number(editData.nivel),
        gmv_total: Number(editData.gmv_total),
        acc_this_month: Number(editData.acc_this_month),
        ttd_this_month: Number(editData.ttd_this_month),
        videos_this_month: Number(editData.videos_this_month),
        status: editData.status as Creator['status'],
      })
      setEditId(null)
    })
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      await addCreator({ email: newEmail, full_name: newName, tiktok_handle: newTiktok })
      setShowAdd(false)
      setNewEmail('')
      setNewName('')
      setNewTiktok('')
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-syne text-lg font-bold text-go-dark">Creators</h2>
        <ActionButton onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? 'Cancelar' : '+ Agregar Creator'}
        </ActionButton>
      </div>

      {feedback && (
        <div className={`font-dm text-sm px-4 py-3 rounded-xl ${feedback.startsWith('Error') ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
          {feedback}
        </div>
      )}

      {showAdd && (
        <SectionCard>
          <form onSubmit={handleAdd} className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormInput label="Nombre" value={newName} onChange={setNewName} required />
            <FormInput label="Email" value={newEmail} onChange={setNewEmail} type="email" required />
            <FormInput label="TikTok Handle" value={newTiktok} onChange={setNewTiktok} placeholder="@handle" required />
            <div className="sm:col-span-3">
              <ActionButton onClick={() => {}}>
                Agregar e invitar
              </ActionButton>
            </div>
          </form>
        </SectionCard>
      )}

      <SectionCard>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-go-border bg-go-light/50">
                <th className="text-left px-4 py-3 font-medium text-go-dark/60">Nombre</th>
                <th className="text-left px-4 py-3 font-medium text-go-dark/60">Email</th>
                <th className="text-left px-4 py-3 font-medium text-go-dark/60">TikTok</th>
                <th className="text-left px-4 py-3 font-medium text-go-dark/60">Nivel</th>
                <th className="text-right px-4 py-3 font-medium text-go-dark/60">GMV</th>
                <th className="text-right px-4 py-3 font-medium text-go-dark/60">ACC</th>
                <th className="text-right px-4 py-3 font-medium text-go-dark/60">TTD</th>
                <th className="text-right px-4 py-3 font-medium text-go-dark/60">Videos</th>
                <th className="text-left px-4 py-3 font-medium text-go-dark/60">Status</th>
                <th className="text-left px-4 py-3 font-medium text-go-dark/60">Código</th>
                <th className="text-right px-4 py-3 font-medium text-go-dark/60">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {creators.map((c) => (
                <tr key={c.id} className="border-b border-go-border/50 hover:bg-go-light/30">
                  <td className="px-4 py-3 font-medium text-go-dark">{c.full_name ?? '—'}</td>
                  <td className="px-4 py-3 text-go-dark/60">{c.email}</td>
                  <td className="px-4 py-3 text-go-orange">{c.tiktok_handle ?? '—'}</td>

                  {editId === c.id ? (
                    <>
                      <td className="px-4 py-3">
                        <select
                          value={editData.nivel}
                          onChange={(e) => setEditData({ ...editData, nivel: Number(e.target.value) })}
                          className="w-16 px-1 py-1 text-xs rounded border border-go-border"
                        >
                          {[1, 2, 3, 4].map((n) => (
                            <option key={n} value={n}>
                              {n} - {NIVEL_NAMES[n]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          value={editData.gmv_total}
                          onChange={(e) => setEditData({ ...editData, gmv_total: e.target.value })}
                          className="w-20 px-1 py-1 text-xs rounded border border-go-border text-right"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          value={editData.acc_this_month}
                          onChange={(e) => setEditData({ ...editData, acc_this_month: e.target.value })}
                          className="w-16 px-1 py-1 text-xs rounded border border-go-border text-right"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          value={editData.ttd_this_month}
                          onChange={(e) => setEditData({ ...editData, ttd_this_month: e.target.value })}
                          className="w-16 px-1 py-1 text-xs rounded border border-go-border text-right"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          value={editData.videos_this_month}
                          onChange={(e) => setEditData({ ...editData, videos_this_month: e.target.value })}
                          className="w-16 px-1 py-1 text-xs rounded border border-go-border text-right"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={editData.status}
                          onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                          className="px-1 py-1 text-xs rounded border border-go-border"
                        >
                          <option value="pending">pending</option>
                          <option value="active">active</option>
                          <option value="suspended">suspended</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-right space-x-1">
                        <ActionButton onClick={() => saveEdit(c.id)}>Guardar</ActionButton>
                        <ActionButton variant="ghost" onClick={() => setEditId(null)}>
                          Cancelar
                        </ActionButton>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium">
                          {c.nivel} - {NIVEL_NAMES[c.nivel] ?? '?'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-go-dark/70">
                        ${c.gmv_total.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-go-dark/70">
                        {c.acc_this_month}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-go-dark/70">
                        {c.ttd_this_month}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-go-dark/70">
                        {c.videos_this_month}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="px-4 py-3">
                        {c.access_code ? (
                          <span className="font-mono text-xs font-bold text-go-orange bg-go-orange/10 px-2 py-1 rounded-lg tracking-widest">{c.access_code}</span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right space-x-1">
                        {c.status === 'pending' && (
                          <ActionButton
                            onClick={() =>
                              startTransition(() => approveCreator(c.id))
                            }
                          >
                            Aprobar
                          </ActionButton>
                        )}
                        {c.access_code && (
                          <ActionButton
                            variant="ghost"
                            onClick={() => {
                              navigator.clipboard.writeText(c.access_code!)
                              fb(`✓ Código copiado: ${c.access_code}`)
                            }}
                          >
                            Copiar código
                          </ActionButton>
                        )}
                        <ActionButton variant="ghost" onClick={() => startEdit(c)}>
                          Editar
                        </ActionButton>
                        <ActionButton variant="ghost" onClick={() => {
                          setStrategyId(c.id)
                          setStrategyForm({
                            acc_goal: String(c.acc_goal ?? ''),
                            ttd_goal: String(c.ttd_goal ?? ''),
                            gmv_goal: String(c.gmv_goal ?? ''),
                            special_hashtags: c.special_hashtags ?? '',
                            creative_brief: c.creative_brief ?? '',
                          })
                        }}>
                          Estrategia
                        </ActionButton>
                        <ActionButton
                          variant="ghost"
                          onClick={() => {
                            if (confirm(`¿Segura que quieres eliminar a ${c.full_name || c.email}? Esta acción no se puede deshacer.`)) {
                              startTransition(async () => {
                                const r = await deleteCreator(c.id)
                                if (r.error) fb(`Error: ${r.error}`)
                              })
                            }
                          }}
                        >
                          Eliminar
                        </ActionButton>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {creators.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-go-dark/40">
                    No hay creators aun
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {strategyId && (
        <div className="mt-4 bg-go-light border border-go-border rounded-2xl p-5">
          <h3 className="font-syne font-bold text-go-dark mb-3">Estrategia mensual</h3>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="block text-xs font-medium text-gray-500 mb-1">ACC videos/mes</label><input type="number" value={strategyForm.acc_goal} onChange={e => setStrategyForm(f => ({...f, acc_goal: e.target.value}))} className="w-full px-3 py-2 rounded-lg border border-go-border bg-go-light text-sm font-dm text-go-dark focus:outline-none focus:ring-2 focus:ring-go-orange/30 focus:border-go-orange transition" /></div>
            <div><label className="block text-xs font-medium text-gray-500 mb-1">TTD videos/mes</label><input type="number" value={strategyForm.ttd_goal} onChange={e => setStrategyForm(f => ({...f, ttd_goal: e.target.value}))} className="w-full px-3 py-2 rounded-lg border border-go-border bg-go-light text-sm font-dm text-go-dark focus:outline-none focus:ring-2 focus:ring-go-orange/30 focus:border-go-orange transition" /></div>
            <div><label className="block text-xs font-medium text-gray-500 mb-1">GMV meta ($)</label><input type="number" value={strategyForm.gmv_goal} onChange={e => setStrategyForm(f => ({...f, gmv_goal: e.target.value}))} className="w-full px-3 py-2 rounded-lg border border-go-border bg-go-light text-sm font-dm text-go-dark focus:outline-none focus:ring-2 focus:ring-go-orange/30 focus:border-go-orange transition" /></div>
          </div>
          <div className="mt-3"><label className="block text-xs font-medium text-gray-500 mb-1">Hashtags especiales (separados por coma)</label><input value={strategyForm.special_hashtags} onChange={e => setStrategyForm(f => ({...f, special_hashtags: e.target.value}))} className="w-full px-3 py-2 rounded-lg border border-go-border bg-go-light text-sm font-dm text-go-dark focus:outline-none focus:ring-2 focus:ring-go-orange/30 focus:border-go-orange transition" /></div>
          <div className="mt-3"><label className="block text-xs font-medium text-gray-500 mb-1">Brief creativo</label><textarea value={strategyForm.creative_brief} onChange={e => setStrategyForm(f => ({...f, creative_brief: e.target.value}))} className="w-full px-3 py-2 rounded-lg border border-go-border bg-go-light text-sm font-dm text-go-dark focus:outline-none focus:ring-2 focus:ring-go-orange/30 focus:border-go-orange transition" rows={3} /></div>
          <div className="flex gap-2 mt-3">
            <button onClick={() => startTransition(async () => {
              const r = await updateCreatorStrategy(strategyId, {
                acc_goal: parseInt(strategyForm.acc_goal) || undefined,
                ttd_goal: parseInt(strategyForm.ttd_goal) || undefined,
                gmv_goal: parseInt(strategyForm.gmv_goal) || undefined,
                special_hashtags: strategyForm.special_hashtags || null,
                creative_brief: strategyForm.creative_brief || null,
              })
              if (r.error) fb(`Error: ${r.error}`)
              else { fb('Estrategia guardada'); setStrategyId(null) }
            })} className="font-dm text-sm font-semibold bg-go-orange text-white px-4 py-2 rounded-xl">Guardar</button>
            <button onClick={() => setStrategyId(null)} className="font-dm text-sm text-gray-500 px-4 py-2">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── POIs Tab ──────────────────────────────────────────

function POIsTab({
  pois,
  startTransition,
}: {
  pois: POI[]
  startTransition: (cb: () => void) => void
}) {
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({
    name: '',
    type: 'hotel' as POI['type'],
    city: '',
    state: '',
    commission: '',
    perk: '',
    min_nivel: '1',
    capcut_template_url: '',
    image_emoji: '',
    cta_label: '',
    cta_url: '',
  })

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      await addPOI({
        name: form.name,
        type: form.type,
        city: form.city,
        state: form.state,
        commission: form.commission,
        perk: form.perk || undefined,
        min_nivel: Number(form.min_nivel),
        capcut_template_url: form.capcut_template_url || undefined,
        image_emoji: form.image_emoji || undefined,
        cta_label: form.cta_label || undefined,
        cta_url: form.cta_url || undefined,
      })
      setShowAdd(false)
      setForm({
        name: '',
        type: 'hotel',
        city: '',
        state: '',
        commission: '',
        perk: '',
        min_nivel: '1',
        capcut_template_url: '',
        image_emoji: '',
        cta_label: '',
        cta_url: '',
      })
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-syne text-lg font-bold text-go-dark">Puntos de Interes</h2>
        <ActionButton onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? 'Cancelar' : '+ Agregar POI'}
        </ActionButton>
      </div>

      {showAdd && (
        <SectionCard>
          <form onSubmit={handleAdd} className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormInput label="Nombre" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
            <FormSelect
              label="Tipo"
              value={form.type}
              onChange={(v) => setForm({ ...form, type: v as POI['type'] })}
              options={[
                { value: 'hotel', label: 'Hotel (ACC)' },
                { value: 'attraction', label: 'Atraccion (TTD)' },
                { value: 'restaurant', label: 'Restaurante' },
              ]}
            />
            <FormInput label="Ciudad" value={form.city} onChange={(v) => setForm({ ...form, city: v })} required />
            <FormInput label="Estado" value={form.state} onChange={(v) => setForm({ ...form, state: v })} required />
            <FormInput label="Comision" value={form.commission} onChange={(v) => setForm({ ...form, commission: v })} placeholder="15% o $500 MXN" required />
            <FormInput label="Perk" value={form.perk} onChange={(v) => setForm({ ...form, perk: v })} placeholder="Noche gratis, etc." />
            <FormSelect
              label="Nivel Minimo"
              value={form.min_nivel}
              onChange={(v) => setForm({ ...form, min_nivel: v })}
              options={[1, 2, 3, 4].map((n) => ({ value: String(n), label: `${n} - ${NIVEL_NAMES[n]}` }))}
            />
            <FormInput label="CapCut Template URL" value={form.capcut_template_url} onChange={(v) => setForm({ ...form, capcut_template_url: v })} />
            <FormInput label="CTA Label" value={form.cta_label} onChange={(v) => setForm({ ...form, cta_label: v })} placeholder="Ej: Reservar ahora" />
            <FormInput label="CTA URL" value={form.cta_url} onChange={(v) => setForm({ ...form, cta_url: v })} placeholder="https://..." />
            <FormInput label="Emoji" value={form.image_emoji} onChange={(v) => setForm({ ...form, image_emoji: v })} placeholder="🏨" />
            <div className="sm:col-span-3">
              <button type="submit" className="px-4 py-2 rounded-lg bg-go-orange text-white text-sm font-medium hover:bg-go-orange/90 transition">
                Agregar POI
              </button>
            </div>
          </form>
        </SectionCard>
      )}

      <SectionCard>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-go-border bg-go-light/50">
                <th className="text-left px-4 py-3 font-medium text-go-dark/60">POI</th>
                <th className="text-left px-4 py-3 font-medium text-go-dark/60">Tipo</th>
                <th className="text-left px-4 py-3 font-medium text-go-dark/60">Ubicacion</th>
                <th className="text-left px-4 py-3 font-medium text-go-dark/60">Comision</th>
                <th className="text-left px-4 py-3 font-medium text-go-dark/60">Perk</th>
                <th className="text-center px-4 py-3 font-medium text-go-dark/60">Min Nivel</th>
                <th className="text-center px-4 py-3 font-medium text-go-dark/60">Vendidos</th>
                <th className="text-center px-4 py-3 font-medium text-go-dark/60">Activo</th>
                <th className="text-right px-4 py-3 font-medium text-go-dark/60">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pois.map((p) => (
                <tr key={p.id} className="border-b border-go-border/50 hover:bg-go-light/30">
                  <td className="px-4 py-3 font-medium text-go-dark">
                    {p.image_emoji && <span className="mr-1">{p.image_emoji}</span>}
                    {p.name}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${POI_TYPE_LABELS[p.type]?.color ?? ''}`}>
                      {POI_TYPE_LABELS[p.type]?.label ?? p.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-go-dark/60">
                    {p.city}, {p.state}
                  </td>
                  <td className="px-4 py-3 text-go-dark/70">{p.commission}</td>
                  <td className="px-4 py-3 text-go-dark/50 text-xs">{p.perk ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-xs font-medium">{p.min_nivel}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <input
                      type="number"
                      min={0}
                      defaultValue={p.times_sold ?? 0}
                      className="w-16 px-2 py-1 rounded-lg border border-go-border bg-go-light text-sm text-center font-dm text-go-dark focus:outline-none focus:ring-2 focus:ring-go-orange/30 focus:border-go-orange transition"
                      onBlur={(e) => {
                        const val = Number(e.target.value)
                        if (val !== (p.times_sold ?? 0)) {
                          startTransition(() => updatePOITimesSold(p.id, val))
                        }
                      }}
                    />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => startTransition(() => togglePOI(p.id, !p.is_active))}
                      className={`w-10 h-5 rounded-full relative transition ${p.is_active ? 'bg-emerald-500' : 'bg-gray-300'}`}
                    >
                      <span
                        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${p.is_active ? 'translate-x-5' : 'translate-x-0.5'}`}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ActionButton
                      variant="danger"
                      onClick={() => {
                        if (confirm('Eliminar este POI?')) {
                          startTransition(() => deletePOI(p.id))
                        }
                      }}
                    >
                      Eliminar
                    </ActionButton>
                  </td>
                </tr>
              ))}
              {pois.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-go-dark/40">
                    No hay POIs aun
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  )
}

// ── Templates Tab ─────────────────────────────────────

function TemplatesTab({
  templates,
  startTransition,
}: {
  templates: CapCutTemplate[]
  startTransition: (cb: () => void) => void
}) {
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    url: '',
    min_nivel: '1',
    video_type: 'general' as CapCutTemplate['video_type'],
  })

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      await addTemplate({
        title: form.title,
        description: form.description || undefined,
        url: form.url,
        min_nivel: Number(form.min_nivel),
        video_type: form.video_type,
      })
      setShowAdd(false)
      setForm({ title: '', description: '', url: '', min_nivel: '1', video_type: 'general' })
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-syne text-lg font-bold text-go-dark">CapCut Templates</h2>
        <ActionButton onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? 'Cancelar' : '+ Agregar Template'}
        </ActionButton>
      </div>

      {showAdd && (
        <SectionCard>
          <form onSubmit={handleAdd} className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormInput label="Titulo" value={form.title} onChange={(v) => setForm({ ...form, title: v })} required />
            <FormInput label="URL" value={form.url} onChange={(v) => setForm({ ...form, url: v })} type="url" required />
            <FormSelect
              label="Tipo de Video"
              value={form.video_type}
              onChange={(v) => setForm({ ...form, video_type: v as CapCutTemplate['video_type'] })}
              options={[
                { value: 'ACC', label: 'ACC' },
                { value: 'TTD', label: 'TTD' },
                { value: 'general', label: 'General' },
              ]}
            />
            <div className="sm:col-span-2">
              <FormInput label="Descripcion" value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
            </div>
            <FormSelect
              label="Nivel Minimo"
              value={form.min_nivel}
              onChange={(v) => setForm({ ...form, min_nivel: v })}
              options={[1, 2, 3, 4].map((n) => ({ value: String(n), label: `${n} - ${NIVEL_NAMES[n]}` }))}
            />
            <div className="sm:col-span-3">
              <button type="submit" className="px-4 py-2 rounded-lg bg-go-orange text-white text-sm font-medium hover:bg-go-orange/90 transition">
                Agregar Template
              </button>
            </div>
          </form>
        </SectionCard>
      )}

      <SectionCard>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-go-border bg-go-light/50">
                <th className="text-left px-4 py-3 font-medium text-go-dark/60">Titulo</th>
                <th className="text-left px-4 py-3 font-medium text-go-dark/60">Descripcion</th>
                <th className="text-center px-4 py-3 font-medium text-go-dark/60">Tipo</th>
                <th className="text-center px-4 py-3 font-medium text-go-dark/60">Min Nivel</th>
                <th className="text-left px-4 py-3 font-medium text-go-dark/60">URL</th>
                <th className="text-right px-4 py-3 font-medium text-go-dark/60">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} className="border-b border-go-border/50 hover:bg-go-light/30">
                  <td className="px-4 py-3 font-medium text-go-dark">{t.title}</td>
                  <td className="px-4 py-3 text-go-dark/50 text-xs max-w-[200px] truncate">
                    {t.description ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        t.video_type === 'ACC'
                          ? 'bg-blue-100 text-blue-700'
                          : t.video_type === 'TTD'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {t.video_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-xs font-medium">{t.min_nivel}</td>
                  <td className="px-4 py-3">
                    <a
                      href={t.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-go-orange hover:underline text-xs truncate block max-w-[200px]"
                    >
                      {t.url}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ActionButton
                      variant="danger"
                      onClick={() => {
                        if (confirm('Eliminar este template?')) {
                          startTransition(() => deleteTemplate(t.id))
                        }
                      }}
                    >
                      Eliminar
                    </ActionButton>
                  </td>
                </tr>
              ))}
              {templates.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-go-dark/40">
                    No hay templates aun
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  )
}

// ── Announcements Tab ─────────────────────────────────

function AnnouncementsTab({
  announcements,
  startTransition,
}: {
  announcements: Announcement[]
  startTransition: (cb: () => void) => void
}) {
  const [newMessage, setNewMessage] = useState('')
  const [newImageUrl, setNewImageUrl] = useState('')

  const activeAnnouncement = announcements.find((a) => a.is_active)

  function handleSet(e: React.FormEvent) {
    e.preventDefault()
    if (!newMessage.trim()) return
    startTransition(async () => {
      await setAnnouncement(newMessage.trim(), newImageUrl.trim() || undefined)
      setNewMessage('')
      setNewImageUrl('')
    })
  }

  return (
    <div className="space-y-4">
      <h2 className="font-syne text-lg font-bold text-go-dark">Anuncios</h2>

      {/* Current active */}
      {activeAnnouncement && (
        <div className="bg-go-orange/10 border border-go-orange/30 rounded-xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-go-orange mb-1">Anuncio activo</p>
              <p className="text-sm text-go-dark">{activeAnnouncement.message}</p>
            </div>
            <button
              onClick={() =>
                startTransition(() =>
                  toggleAnnouncement(activeAnnouncement.id, false)
                )
              }
              className="text-xs text-red-600 hover:text-red-700 whitespace-nowrap"
            >
              Desactivar
            </button>
          </div>
        </div>
      )}

      {/* New announcement form */}
      <SectionCard>
        <form onSubmit={handleSet} className="p-4">
          <label className="block text-xs font-medium text-go-dark/60 mb-2">
            Nuevo anuncio
          </label>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Escribe el mensaje del anuncio..."
                className="flex-1 px-4 py-2.5 rounded-xl border border-go-border bg-go-light text-sm font-dm text-go-dark focus:outline-none focus:ring-2 focus:ring-go-orange/30 focus:border-go-orange transition"
              />
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-go-orange text-white text-sm font-medium hover:bg-go-orange/90 transition"
              >
                Publicar
              </button>
            </div>
            <input
              type="url"
              value={newImageUrl}
              onChange={(e) => setNewImageUrl(e.target.value)}
              placeholder="URL de imagen (opcional)"
              className="px-4 py-2.5 rounded-xl border border-go-border bg-go-light text-sm font-dm text-go-dark focus:outline-none focus:ring-2 focus:ring-go-orange/30 focus:border-go-orange transition"
            />
          </div>
        </form>
      </SectionCard>

      {/* History */}
      {announcements.length > 0 && (
        <SectionCard>
          <div className="p-4">
            <h3 className="text-xs font-medium text-go-dark/60 mb-3">Historial</h3>
            <div className="space-y-2">
              {announcements.map((a) => (
                <div
                  key={a.id}
                  className={`flex items-center justify-between gap-3 p-3 rounded-lg border ${a.is_active ? 'border-go-orange/30 bg-go-orange/5' : 'border-go-border bg-go-light/50'}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-go-dark truncate">{a.message}</p>
                    <p className="text-xs text-go-dark/40 mt-0.5">
                      {new Date(a.created_at).toLocaleDateString('es-MX', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={a.is_active ? 'active' : 'pending'} />
                    <button
                      onClick={() =>
                        startTransition(() =>
                          toggleAnnouncement(a.id, !a.is_active)
                        )
                      }
                      className={`w-10 h-5 rounded-full relative transition ${a.is_active ? 'bg-emerald-500' : 'bg-gray-300'}`}
                    >
                      <span
                        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${a.is_active ? 'translate-x-5' : 'translate-x-0.5'}`}
                      />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  )
}

// ── Portfolios Tab ────────────────────────────────────

function PortfoliosTab({
  portfolios,
  startTransition,
}: {
  portfolios: PortfolioSubmission[]
  startTransition: (cb: () => void) => void
}) {
  const [editId, setEditId] = useState<string | null>(null)
  const [editStatus, setEditStatus] = useState<PortfolioSubmission['status']>('pending')
  const [editNotes, setEditNotes] = useState('')

  function startEdit(p: PortfolioSubmission) {
    setEditId(p.id)
    setEditStatus(p.status)
    setEditNotes(p.notes ?? '')
  }

  function saveEdit(id: string) {
    startTransition(async () => {
      await updatePortfolioStatus(id, editStatus, editNotes)
      setEditId(null)
    })
  }

  return (
    <div className="space-y-4">
      <h2 className="font-syne text-lg font-bold text-go-dark">Portfolio Submissions</h2>

      <SectionCard>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-go-border bg-go-light/50">
                <th className="text-left px-4 py-3 font-medium text-go-dark/60">Creator</th>
                <th className="text-left px-4 py-3 font-medium text-go-dark/60">Email</th>
                <th className="text-center px-4 py-3 font-medium text-go-dark/60">Nivel</th>
                <th className="text-left px-4 py-3 font-medium text-go-dark/60">Links</th>
                <th className="text-left px-4 py-3 font-medium text-go-dark/60">Media Kit</th>
                <th className="text-left px-4 py-3 font-medium text-go-dark/60">Status</th>
                <th className="text-left px-4 py-3 font-medium text-go-dark/60">Notas</th>
                <th className="text-left px-4 py-3 font-medium text-go-dark/60">Fecha</th>
                <th className="text-right px-4 py-3 font-medium text-go-dark/60">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {portfolios.map((p) => (
                <tr key={p.id} className="border-b border-go-border/50 hover:bg-go-light/30">
                  <td className="px-4 py-3 font-medium text-go-dark">
                    {p.creator?.full_name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-go-dark/60 text-xs">
                    {p.creator?.email ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-center text-xs font-medium">
                    {p.creator?.nivel ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      {p.video_links?.map((link, i) => (
                        <a
                          key={i}
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-go-orange hover:underline text-xs truncate max-w-[150px] block"
                        >
                          Video {i + 1}
                        </a>
                      ))}
                      {(!p.video_links || p.video_links.length === 0) && (
                        <span className="text-go-dark/30 text-xs">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {p.media_kit_url ? (
                      <a
                        href={p.media_kit_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-go-orange hover:underline text-xs"
                      >
                        Ver
                      </a>
                    ) : (
                      <span className="text-go-dark/30 text-xs">—</span>
                    )}
                  </td>

                  {editId === p.id ? (
                    <>
                      <td className="px-4 py-3">
                        <select
                          value={editStatus}
                          onChange={(e) =>
                            setEditStatus(e.target.value as PortfolioSubmission['status'])
                          }
                          className="px-2 py-1 text-xs rounded border border-go-border"
                        >
                          <option value="pending">pending</option>
                          <option value="reviewed">reviewed</option>
                          <option value="pitched">pitched</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          placeholder="Notas..."
                          className="w-full px-2 py-1 text-xs rounded border border-go-border"
                        />
                      </td>
                      <td className="px-4 py-3 text-xs text-go-dark/40">
                        {new Date(p.created_at).toLocaleDateString('es-MX')}
                      </td>
                      <td className="px-4 py-3 text-right space-x-1">
                        <ActionButton onClick={() => saveEdit(p.id)}>Guardar</ActionButton>
                        <ActionButton variant="ghost" onClick={() => setEditId(null)}>
                          Cancelar
                        </ActionButton>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="px-4 py-3 text-xs text-go-dark/50 max-w-[150px] truncate">
                        {p.notes ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-go-dark/40">
                        {new Date(p.created_at).toLocaleDateString('es-MX')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ActionButton variant="ghost" onClick={() => startEdit(p)}>
                          Revisar
                        </ActionButton>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {portfolios.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-go-dark/40">
                    No hay submissions aun
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  )
}
