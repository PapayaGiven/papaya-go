'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type {
  Creator,
  POI,
  CapCutTemplate,
  Announcement,
  PortfolioSubmission,
  NivelReward,
  NivelRequirement,
  BoostRequest,
  RewardRequest,
  Challenge,
  TikTokAccount,
  InternalVideo,
  MonthlyGoal,
  MonthlySnapshot,
  CreatorSnapshot,
  LevelUpEvent,
  TopPoi,
  BoostStatus,
} from '@/lib/types'
import { NIVEL_NAMES, POI_TYPE_LABELS, CHALLENGE_TYPE_LABELS } from '@/lib/types'
import {
  adminLogout,
  approveCreator,
  updateCreator,
  addCreator,
  deleteCreator,
  updateCreatorStrategy,
  addPOI,
  updatePOI,
  togglePOI,
  deletePOI,
  addTemplate,
  deleteTemplate,
  setAnnouncement,
  toggleAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  updatePortfolioStatus,
  addViralVideo,
  toggleViralVideo,
  deleteViralVideo,
  syncViralVideosFromSheet,
  updatePOIRequestStatus,
  updatePOITimesSold,
  addNivelReward,
  updateNivelReward,
  toggleNivelReward,
  deleteNivelReward,
  updateNivelRequirement,
  // updateBoostStatus retired in favor of setBoostValidity + setBoostStatus

  updateRewardRequestStatus,
  // Plan Semanal + Plan Global archived for now — addWeeklyPlan/
  // toggleWeeklyPlan/deleteWeeklyPlan/saveContentPlan/getCreatorPlan/
  // applyGlobalPlan stay exported in app/admin/actions so we can re-enable
  // the feature later without re-implementing the server side.
  addChallenge,
  toggleChallenge,
  deleteChallenge,
  toggleCreatorInternal,
  addTikTokAccount,
  updateTikTokAccount,
  deleteTikTokAccount,
  approveInternalVideo,
  rejectInternalVideo,
  bulkApproveInternalVideos,
  getInternalVideoStats,
  upsertMonthlyGoal,
  // approveBoostRequest, rejectBoostRequest — replaced by setBoostValidity + setBoostStatus

  takeMonthlySnapshot,
  updateCreatorNivel,
  setBoostValidity,
  setBoostInvalid,
  setBoostStatus,
  updateBoostRequest,
  syncTopPois,
  updateTopPoi,
  deleteTopPoi,
  resetCalendarMonth,
  adminSubmitVideosForCreator,
} from '@/app/admin/actions'
import TikTokPreviewModal, { PreviewButton } from './TikTokPreviewModal'

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

type Tab = 'dashboard' | 'crecimiento' | 'creators' | 'pois' | 'top-pois' | 'templates' | 'announcements' | 'portfolios' | 'viral' | 'poi-requests' | 'rewards-admin' | 'boosts' | 'reward-requests' | 'challenges' | 'tiktok-accounts' | 'internal-videos'

interface AdminPanelProps {
  creators: Creator[]
  pois: POI[]
  templates: CapCutTemplate[]
  announcements: Announcement[]
  portfolios: PortfolioSubmission[]
  viralVideos: ViralVideo[]
  poiRequests: POIRequest[]
  nivelRewards: NivelReward[]
  nivelRequirements: NivelRequirement[]
  boostRequests: BoostRequest[]
  rewardRequests: RewardRequest[]
  challenges: Challenge[]
  tiktokAccounts: TikTokAccount[]
  internalVideos: InternalVideo[]
  monthlyGoal: MonthlyGoal | null
  monthlySnapshots: MonthlySnapshot[]
  creatorSnapshots: CreatorSnapshot[]
  levelUpEvents: LevelUpEvent[]
  topPois: TopPoi[]
  currentMonth: number
  currentYear: number
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

// ── Form Fields Builder ─────────────────────────────

interface FormFieldItem {
  label: string
  type: string
  required: boolean
  options?: string[]
}

interface FormFieldBuilderProps {
  fields: FormFieldItem[]
  onChange: (fields: FormFieldItem[]) => void
}

function FormFieldsBuilder({ fields, onChange }: FormFieldBuilderProps) {
  // Keep a local copy of fields to avoid parent re-render on every keystroke
  const [localFields, setLocalFields] = useState<FormFieldItem[]>(fields)
  const initializedRef = useRef(false)

  // Sync from parent only when fields prop changes externally (e.g. loading saved reward)
  if (!initializedRef.current || (fields.length !== localFields.length && fields !== localFields)) {
    if (JSON.stringify(fields) !== JSON.stringify(localFields)) {
      setLocalFields(fields)
    }
    initializedRef.current = true
  }

  function update(newFields: FormFieldItem[]) {
    setLocalFields(newFields)
    onChange(newFields)
  }

  function addField() {
    update([...localFields, { label: '', type: 'text', required: false }])
  }

  function removeField(idx: number) {
    update(localFields.filter((_, i) => i !== idx))
  }

  function updateField(idx: number, key: string, value: unknown) {
    const updated = localFields.map((f, i) => i === idx ? { ...f, [key]: value } : f)
    setLocalFields(updated)
    // Debounce parent update for text inputs to prevent re-render cascade
    onChange(updated)
  }

  const inputCls = 'px-3 py-2 rounded-lg border border-orange-200 focus:outline-none focus:ring-2 focus:ring-go-orange/40 focus:border-go-orange font-dm text-sm bg-white text-go-dark placeholder-gray-400 transition'

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-gray-500">Campos del formulario</p>
      {localFields.map((f, idx) => (
        <div key={idx} className="border border-go-border rounded-xl p-3">
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Ej: Tu nombre, Dirección, Talla..."
              value={f.label}
              onChange={e => updateField(idx, 'label', e.target.value)}
              className={inputCls}
              style={{ flex: '2 1 40%', minWidth: 0 }}
            />
            <select
              value={f.type}
              onChange={e => updateField(idx, 'type', e.target.value)}
              className={inputCls}
              style={{ flex: '1 1 30%', minWidth: 0 }}
            >
              <option value="text">Texto corto</option>
              <option value="textarea">Texto largo</option>
              <option value="email">Email</option>
              <option value="tel">Teléfono</option>
              <option value="dropdown">Dropdown</option>
              <option value="checkbox">Checkbox</option>
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', flexShrink: 0, fontSize: '11px' }}>
              <input type="checkbox" checked={f.required} onChange={e => updateField(idx, 'required', e.target.checked)} style={{ accentColor: '#ff7700' }} />
              Req.
            </label>
            <button type="button" onClick={() => removeField(idx)} style={{ fontSize: '12px', color: '#f87171', flexShrink: 0, cursor: 'pointer', background: 'none', border: 'none' }}>✕</button>
          </div>
          {f.type === 'dropdown' && (
            <div style={{ marginTop: '8px' }}>
              <input
                type="text"
                placeholder="Opciones separadas por coma: XS, S, M, L, XL"
                value={(f.options ?? []).join(', ')}
                onChange={e => updateField(idx, 'options', e.target.value.split(',').map(o => o.trim()).filter(Boolean))}
                className={inputCls}
                style={{ width: '100%', fontSize: '12px' }}
              />
            </div>
          )}
        </div>
      ))}
      <button type="button" onClick={addField} style={{ fontSize: '12px', fontWeight: 600, color: '#ff7700', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}>
        + Agregar campo
      </button>
    </div>
  )
}

// ── Nivel Rewards Tab ────────────────────────────────

// Editable per-nivel commitment table. Lives at the top of the Rewards tab
// so admin can adjust the level-up bar without touching the DB. Writes via
// updateNivelRequirement, which checkAndApplyLevelUps reads from on each
// validation pass.
function NivelRequirementsCard({
  requirements,
  startTransition,
}: {
  requirements: NivelRequirement[]
  startTransition: (fn: () => void) => void
}) {
  type Draft = { acc_required: string; ttd_required: string; total_videos_required: string; gmv_required: string; perks: string }
  const niveles: Array<{ nivel: number; label: string }> = [
    { nivel: 1, label: '1 Explorer' },
    { nivel: 2, label: '2 Contributor' },
    { nivel: 3, label: '3 Partner' },
    { nivel: 4, label: '4 Elite' },
  ]
  const byNivel = new Map(requirements.map(r => [r.nivel, r]))
  const initial = (n: number): Draft => {
    const r = byNivel.get(n)
    return {
      acc_required: String(r?.acc_required ?? 0),
      ttd_required: String(r?.ttd_required ?? 0),
      total_videos_required: String(r?.total_videos_required ?? 0),
      gmv_required: String(r?.gmv_required ?? 0),
      perks: r?.perks ?? '',
    }
  }
  const [drafts, setDrafts] = useState<Record<number, Draft>>(() =>
    Object.fromEntries(niveles.map(({ nivel }) => [nivel, initial(nivel)])),
  )
  const [feedback, setFeedback] = useState<string | null>(null)
  const [savingNivel, setSavingNivel] = useState<number | null>(null)
  function fb(msg: string) { setFeedback(msg); setTimeout(() => setFeedback(null), 4000) }
  function patch(nivel: number, key: keyof Draft, value: string) {
    setDrafts(prev => ({ ...prev, [nivel]: { ...prev[nivel], [key]: value } }))
  }

  return (
    <SectionCard>
      <div className="p-6">
        <h2 className="font-syne font-bold text-lg text-go-dark">📋 Requisitos por Nivel</h2>
        <p className="font-dm text-xs text-go-dark/60 mt-1 mb-4">
          Define cuántos videos y GMV necesita cada creadora para alcanzar cada nivel.
        </p>
        {feedback && (
          <p className={`text-sm font-dm mb-3 px-3 py-2 rounded-lg ${feedback.startsWith('Error') ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>
            {feedback}
          </p>
        )}
        <div className="overflow-x-auto rounded-2xl border border-go-dark/5">
          <table className="w-full text-sm font-dm">
            <thead className="bg-go-dark/[0.03]">
              <tr>
                {['Nivel', 'ACC/mes', 'TTD/mes', 'Total/mes', 'GMV $', 'Perks', ''].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-[10px] text-go-dark/50 font-semibold uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-go-dark/5">
              {niveles.map(({ nivel, label }) => {
                const d = drafts[nivel]
                const saving = savingNivel === nivel
                return (
                  <tr key={nivel}>
                    <td className="px-3 py-2 font-semibold text-go-dark whitespace-nowrap">{label}</td>
                    <td className="px-3 py-2">
                      <input type="number" min="0" value={d.acc_required} onChange={e => patch(nivel, 'acc_required', e.target.value)}
                        className="w-20 px-2 py-1 rounded-md border border-go-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-go-orange/30" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" min="0" value={d.ttd_required} onChange={e => patch(nivel, 'ttd_required', e.target.value)}
                        className="w-20 px-2 py-1 rounded-md border border-go-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-go-orange/30" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" min="0" value={d.total_videos_required} onChange={e => patch(nivel, 'total_videos_required', e.target.value)}
                        className="w-20 px-2 py-1 rounded-md border border-go-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-go-orange/30" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" min="0" value={d.gmv_required} onChange={e => patch(nivel, 'gmv_required', e.target.value)}
                        className="w-24 px-2 py-1 rounded-md border border-go-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-go-orange/30" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="text" value={d.perks} onChange={e => patch(nivel, 'perks', e.target.value)}
                        placeholder="Beneficios de este nivel"
                        className="w-full min-w-[200px] px-2 py-1 rounded-md border border-go-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-go-orange/30" />
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => {
                          setSavingNivel(nivel)
                          startTransition(async () => {
                            const r = await updateNivelRequirement(nivel, {
                              acc_required: parseInt(d.acc_required) || 0,
                              ttd_required: parseInt(d.ttd_required) || 0,
                              total_videos_required: parseInt(d.total_videos_required) || 0,
                              gmv_required: parseInt(d.gmv_required) || 0,
                              perks: d.perks.trim() || null,
                            })
                            setSavingNivel(null)
                            if (r.error) fb(`Error: ${r.error}`)
                            else fb(`✅ Nivel ${nivel} actualizado`)
                          })
                        }}
                        className="text-xs font-semibold bg-go-orange text-white px-3 py-1.5 rounded-md hover:bg-go-orange/90 disabled:opacity-50"
                      >{saving ? 'Guardando…' : 'Guardar'}</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </SectionCard>
  )
}

function NivelRewardsTab({ rewards, requirements, startTransition }: { rewards: NivelReward[]; requirements: NivelRequirement[]; startTransition: (fn: () => void) => void }) {
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ nivel: '1', reward_name: '', reward_description: '', reward_emoji: '🎁', cta_label: '', cta_url: '', cta_type: 'none', cta_whatsapp_message: '', form_fields: [] as Array<{label: string; type: string; required: boolean; options?: string[]}> })
  const [feedback, setFeedback] = useState<string | null>(null)
  function fb(msg: string) { setFeedback(msg); setTimeout(() => setFeedback(null), 5000) }

  function startEdit(r: NivelReward) {
    setEditingId(r.id)
    setForm({
      nivel: String(r.nivel),
      reward_name: r.reward_name,
      reward_description: r.reward_description ?? '',
      reward_emoji: r.reward_emoji,
      cta_label: r.cta_label ?? '',
      cta_url: r.cta_url ?? '',
      cta_type: r.cta_type ?? 'none',
      cta_whatsapp_message: r.cta_whatsapp_message ?? '',
      form_fields: r.form_fields ?? [],
    })
    setShowAdd(true)
  }

  function resetForm() {
    setEditingId(null)
    setForm({ nivel: '1', reward_name: '', reward_description: '', reward_emoji: '🎁', cta_label: '', cta_url: '', cta_type: 'none', cta_whatsapp_message: '', form_fields: [] })
    setShowAdd(false)
  }

  const grouped = [1, 2, 3, 4].map(n => ({ nivel: n, items: rewards.filter(r => r.nivel === n) }))

  return (
    <div className="space-y-6">
      <NivelRequirementsCard requirements={requirements} startTransition={startTransition} />
      <SectionCard>
      <div className="p-6">
        <h2 className="font-syne font-bold text-lg text-go-dark mb-4">Rewards por Nivel ({rewards.length})</h2>

        <button onClick={() => { if (showAdd) resetForm(); else setShowAdd(true) }} className="font-dm text-sm font-semibold bg-go-orange text-white px-4 py-2 rounded-xl hover:bg-go-orange/90 transition mb-4">
          {showAdd ? 'Cancelar' : '+ Agregar Reward'}
        </button>

        {feedback && <p className={`text-sm font-dm mb-3 px-3 py-2 rounded-lg ${feedback.startsWith('Error') ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>{feedback}</p>}

        {showAdd && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              startTransition(async () => {
                if (editingId) {
                  const res = await updateNivelReward(editingId, {
                    nivel: parseInt(form.nivel),
                    reward_name: form.reward_name,
                    reward_description: form.reward_description || null,
                    reward_emoji: form.reward_emoji,
                    cta_label: form.cta_label || null,
                    cta_url: form.cta_url || null,
                    cta_type: form.cta_type,
                    cta_whatsapp_message: form.cta_whatsapp_message || null,
                    form_fields: form.form_fields.length > 0 ? form.form_fields : null,
                  })
                  if (res.error) fb(`Error: ${res.error}`)
                  else { fb('Reward actualizado'); resetForm() }
                } else {
                  const res = await addNivelReward({
                    nivel: parseInt(form.nivel),
                    reward_name: form.reward_name,
                    reward_description: form.reward_description || null,
                    reward_emoji: form.reward_emoji,
                    cta_label: form.cta_label || null,
                    cta_url: form.cta_url || null,
                    cta_type: form.cta_type,
                    cta_whatsapp_message: form.cta_whatsapp_message || null,
                    form_fields: form.form_fields.length > 0 ? form.form_fields : null,
                  })
                  if (res.error) fb(`Error: ${res.error}`)
                  else { fb('Reward agregado'); resetForm() }
                }
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
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Tipo de CTA</label>
              <select value={form.cta_type} onChange={e => setForm({...form, cta_type: e.target.value})} className="input-field">
                <option value="none">Sin CTA (solo Solicitar)</option>
                <option value="link">Link externo</option>
                <option value="form">Formulario</option>
                <option value="upload">Subir archivo</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
            </div>
            <FormInput label="CTA Label" value={form.cta_label} onChange={(v) => setForm({ ...form, cta_label: v })} />
            {form.cta_type === 'link' && (
              <FormInput label="URL del CTA" value={form.cta_url} onChange={(v) => setForm({ ...form, cta_url: v })} />
            )}
            {form.cta_type === 'whatsapp' && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Mensaje de WhatsApp</label>
                <input value={form.cta_whatsapp_message} onChange={e => setForm({...form, cta_whatsapp_message: e.target.value})} className="input-field" placeholder="Hola! Quiero solicitar mi reward..." />
              </div>
            )}
            {form.cta_type === 'form' && (
              <div className="sm:col-span-4">
                <FormFieldsBuilder fields={form.form_fields} onChange={fields => setForm({...form, form_fields: fields})} />
              </div>
            )}
            <div className="sm:col-span-2 flex items-end">
              <ActionButton onClick={() => {}} variant="primary">{editingId ? 'Actualizar' : 'Guardar'}</ActionButton>
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
                    {['Emoji', 'Nombre', 'Descripcion', 'CTA', 'Activo', 'Acciones'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs text-go-dark/50 font-semibold uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-go-dark/5">
                  {g.items.map(r => (
                    <tr key={r.id} className={!r.is_active ? 'opacity-40' : ''}>
                      <td className="px-4 py-3 text-lg">{r.reward_emoji}</td>
                      <td className="px-4 py-3 font-medium text-go-dark">{r.reward_name} <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{r.cta_type ?? 'none'}</span></td>
                      <td className="px-4 py-3 text-go-dark/60 text-xs">{r.reward_description ?? '—'}</td>
                      <td className="px-4 py-3 text-go-dark/60 text-xs">{r.cta_label ? `${r.cta_label}` : '—'}</td>
                      <td className="px-4 py-3">
                        <ActionButton onClick={() => startTransition(async () => {
                          const res = await toggleNivelReward(r.id, !r.is_active)
                          if (res.error) fb(`Error: ${res.error}`)
                          else fb(r.is_active ? 'Desactivado' : 'Activado')
                        })} variant="ghost">
                          {r.is_active ? 'Desactivar' : 'Activar'}
                        </ActionButton>
                      </td>
                      <td className="px-4 py-3 flex gap-2">
                        <ActionButton onClick={() => startEdit(r)} variant="ghost">
                          Editar
                        </ActionButton>
                        <ActionButton onClick={() => startTransition(async () => {
                          await deleteNivelReward(r.id)
                          fb('Reward eliminado')
                        })} variant="danger">
                          Eliminar
                        </ActionButton>
                      </td>
                    </tr>
                  ))}
                  {g.items.length === 0 && <tr><td colSpan={6} className="px-4 py-4 text-center text-go-dark/40 text-xs">Sin rewards para este nivel.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
    </div>
  )
}

// ── Admin: submit videos for a creator (modal body) ─────
//
// Shared between the per-creator "🎬 Agregar Videos" button in CreatorsTab
// and the bulk "📥 Importar Videos de Mayo" button on the admin Dashboard.
// Caller supplies an optional preselected creatorId (per-creator flow) or
// lets the admin pick from a dropdown (bulk flow).

interface SubmitRow { url: string; type: 'ACC' | 'TTD' | null; boost: boolean; error?: string }

function AdminVideoSubmitModal({
  creators, defaultCreatorId, defaultDate, onClose, startTransition,
}: {
  creators: Creator[]
  defaultCreatorId?: string
  defaultDate?: string
  onClose: () => void
  startTransition: (cb: () => void) => void
}) {
  const [creatorId, setCreatorId] = useState(defaultCreatorId ?? '')
  const [date, setDate] = useState(defaultDate ?? new Date().toISOString().split('T')[0])
  const [rows, setRows] = useState<SubmitRow[]>([{ url: '', type: null, boost: false }])
  const [topError, setTopError] = useState('')
  const [done, setDone] = useState<{ inserted: number; creatorName: string } | null>(null)

  const selectedCreator = creators.find(c => c.id === creatorId)

  function update(i: number, patch: Partial<SubmitRow>) {
    setRows((p) => p.map((r, idx) => idx === i ? { ...r, ...patch, error: undefined } : r))
    setTopError('')
  }
  function addRow() { setRows((p) => [...p, { url: '', type: null, boost: false }]) }
  function removeRow(i: number) { setRows((p) => p.length === 1 ? p : p.filter((_, idx) => idx !== i)) }

  function submit() {
    setTopError('')
    if (!creatorId) { setTopError('Selecciona una creadora'); return }
    const cleaned = rows.map((r) => ({ ...r, error: undefined as string | undefined }))
    cleaned.forEach((r) => {
      if (!r.url.trim()) r.error = 'URL requerida'
      else if (!r.type) r.error = 'Selecciona ACC o TTD'
    })
    if (cleaned.some(r => r.error)) { setRows(cleaned); setTopError('Revisa los errores'); return }

    startTransition(async () => {
      const res = await adminSubmitVideosForCreator({
        creator_id: creatorId,
        date,
        videos: cleaned.map(r => ({ tiktok_url: r.url, video_type: r.type as 'ACC' | 'TTD', boost_requested: r.boost })),
      })
      if (res.error) { setTopError(res.error); return }
      if (res.rowErrors && res.rowErrors.length) {
        const next = [...cleaned]
        for (const e of res.rowErrors) if (next[e.index]) next[e.index].error = e.message
        setRows(next)
        setTopError('Revisa los errores marcados')
        return
      }
      setDone({ inserted: res.inserted ?? 0, creatorName: selectedCreator?.full_name ?? selectedCreator?.email ?? 'creator' })
    })
  }

  return (
    <div className="fixed inset-0 z-[180] bg-black/60 flex items-center justify-center px-4 py-8" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-full overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4 gap-3">
          <h3 className="font-syne font-bold text-lg text-go-dark">
            {selectedCreator ? `Agregar videos para ${selectedCreator.full_name ?? selectedCreator.email}` : 'Importar videos'}
          </h3>
          <button onClick={onClose} className="text-go-dark/40 hover:text-go-dark text-lg leading-none">×</button>
        </div>

        {done ? (
          <div className="text-center py-6">
            <p className="font-dm text-go-orange font-bold text-base">✅ {done.inserted} videos agregados para {done.creatorName}</p>
            <p className="font-dm text-xs text-go-dark/60 mt-2">
              {date >= new Date().toISOString().split('T')[0].slice(0, 7) + '-01'
                ? 'Los contadores de este mes se actualizaron.'
                : 'Fecha en mes pasado — los contadores actuales no se modificaron.'}
            </p>
            <button onClick={onClose} className="mt-4 bg-go-orange text-white font-dm font-semibold text-sm px-4 py-2 rounded-lg">Cerrar</button>
          </div>
        ) : (
          <div className="space-y-3">
            {!defaultCreatorId && (
              <div>
                <label className="block font-dm text-xs font-semibold text-go-dark/60 uppercase mb-1">Creadora</label>
                <select
                  value={creatorId}
                  onChange={(e) => setCreatorId(e.target.value)}
                  className="w-full border border-go-border rounded-lg px-3 py-2 font-dm text-sm"
                >
                  <option value="">Selecciona…</option>
                  {creators.filter(c => c.status === 'active').map(c => (
                    <option key={c.id} value={c.id}>{c.full_name ?? c.email}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block font-dm text-xs font-semibold text-go-dark/60 uppercase mb-1">Fecha de los videos</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border border-go-border rounded-lg px-3 py-2 font-dm text-sm"
              />
            </div>

            <p className="font-dm text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              ℹ️ <strong>is_valid = true</strong> automáticamente — estos videos contarán para la creadora.
            </p>

            <div className="space-y-2">
              {rows.map((r, i) => (
                <div key={i} className={`p-3 rounded-xl border ${r.error ? 'border-red-300 bg-red-50' : 'border-go-border bg-go-light/50'}`}>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="url"
                      value={r.url}
                      onChange={(e) => update(i, { url: e.target.value })}
                      placeholder="https://www.tiktok.com/@..."
                      className="flex-1 border border-go-border rounded-md px-2 py-1.5 font-dm text-sm bg-white"
                    />
                    {rows.length > 1 && (
                      <button onClick={() => removeRow(i)} className="text-red-400 px-2">×</button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex gap-1">
                      {(['ACC', 'TTD'] as const).map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => update(i, { type: t })}
                          className={`text-xs font-semibold px-3 py-1 rounded-md border ${r.type === t ? 'bg-go-orange text-white border-go-orange' : 'bg-white text-go-dark/60 border-go-border'}`}
                        >{t}</button>
                      ))}
                    </div>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={r.boost} onChange={(e) => update(i, { boost: e.target.checked })} className="w-3.5 h-3.5 accent-go-orange" />
                      <span className="font-dm text-xs text-go-dark/70">🚀 Boost</span>
                    </label>
                    {r.error && <span className="font-dm text-xs text-red-600 ml-auto">{r.error}</span>}
                  </div>
                </div>
              ))}
            </div>

            <button onClick={addRow} className="w-full border-2 border-dashed border-go-orange/40 text-go-orange font-dm text-xs font-semibold py-2 rounded-lg hover:bg-go-orange/5">+ Agregar otro video</button>

            {topError && <p className="font-dm text-sm text-red-600">{topError}</p>}

            <div className="flex gap-2 pt-2">
              <button onClick={submit} className="flex-1 bg-go-orange text-white font-dm font-bold text-sm py-2.5 rounded-lg hover:bg-go-orange/90">Enviar videos</button>
              <button onClick={onClose} className="flex-1 bg-go-dark/[0.06] text-go-dark/70 font-dm font-semibold text-sm py-2.5 rounded-lg">Cancelar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Reset Mayo modal ────────────────────────────────────

function ResetMonthModal({ onClose, startTransition }: { onClose: () => void; startTransition: (cb: () => void) => void }) {
  const [step, setStep] = useState<1 | 2>(1)
  const [confirm, setConfirm] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [done, setDone] = useState<{ backedUp: number } | null>(null)

  function fb(msg: string) { setFeedback(msg) }

  return (
    <div className="fixed inset-0 z-[180] bg-black/60 flex items-center justify-center px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        {done ? (
          <div className="text-center">
            <p className="font-dm text-emerald-700 font-bold text-base mb-2">✅ Reset completado</p>
            <p className="font-dm text-sm text-go-dark/70">Backup de {done.backedUp} videos guardado. Contadores en 0.</p>
            <button onClick={onClose} className="mt-4 bg-go-orange text-white font-dm font-semibold text-sm px-4 py-2 rounded-lg">Cerrar</button>
          </div>
        ) : step === 1 ? (
          <>
            <h3 className="font-syne font-bold text-lg text-red-700 mb-3">⚠️ ATENCIÓN</h3>
            <p className="font-dm text-sm text-go-dark/80 mb-4">
              Esto eliminará TODOS los videos de Mayo 2026 y pondrá los contadores en 0. Se guardará un backup primero. ¿Estás segura?
            </p>
            <div className="flex gap-2">
              <button onClick={() => setStep(2)} className="flex-1 bg-red-500 text-white font-dm font-bold text-sm py-2.5 rounded-lg hover:bg-red-600">Continuar →</button>
              <button onClick={onClose} className="flex-1 bg-go-dark/[0.06] text-go-dark/70 font-dm font-semibold text-sm py-2.5 rounded-lg">Cancelar</button>
            </div>
          </>
        ) : (
          <>
            <h3 className="font-syne font-bold text-lg text-red-700 mb-3">Confirma escribiendo:</h3>
            <p className="font-mono font-bold text-base text-go-dark mb-3">RESET MAYO</p>
            <input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Escribe RESET MAYO"
              className="w-full border-2 border-red-200 rounded-lg px-3 py-2 font-mono text-sm mb-3"
              autoFocus
            />
            {feedback && <p className="font-dm text-sm text-red-600 mb-2">{feedback}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => startTransition(async () => {
                  fb('')
                  const r = await resetCalendarMonth(5, 2026, confirm)
                  if (r.error) { fb(r.error); return }
                  setDone({ backedUp: r.backedUp ?? 0 })
                })}
                className="flex-1 bg-red-500 text-white font-dm font-bold text-sm py-2.5 rounded-lg hover:bg-red-600"
              >🔄 Resetear Mayo</button>
              <button onClick={onClose} className="flex-1 bg-go-dark/[0.06] text-go-dark/70 font-dm font-semibold text-sm py-2.5 rounded-lg">Cancelar</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// Short TikTok links (tiktok.com/t/, vm.tiktok.com/) are region/device
// dependent and may resolve to the wrong video. Surface a warning badge
// so admin can ask the creator to re-submit with the full link.
function isShortTikTokLink(url: string | null | undefined): boolean {
  if (!url) return false
  return /tiktok\.com\/t\//i.test(url) || /vm\.tiktok\.com/i.test(url) || /vt\.tiktok\.com/i.test(url)
}

function ShortLinkBadge({ url }: { url: string | null | undefined }) {
  if (!isShortTikTokLink(url)) return null
  // Tooltip carries the full instruction ("Pide a la creadora que reenvíe
  // el link completo") since the badge has no room inline. Compact note
  // sits beside it for screens with space.
  return (
    <>
      <span
        className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700"
        title="Link corto — pide a la creadora que reenvíe el link completo"
      >⚠️ Link corto</span>
      <span className="text-[10px] text-orange-700/80 font-dm hidden sm:inline">
        Pide a la creadora que reenvíe el link completo
      </span>
    </>
  )
}

// Inline link editor used in the admin tables. Click ✏️ Editar link to swap
// the URL for an input + save/cancel; saving calls updateBoostRequest. This
// is the manual escape hatch when a creator pastes a short link and admin
// gets the full link via WhatsApp.
function EditableLinkRow({
  boostId,
  url,
  onSaved,
}: {
  boostId: string
  url: string | null | undefined
  onSaved: (msg: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(url ?? '')
  const [saving, setSaving] = useState(false)

  if (!editing) {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setDraft(url ?? ''); setEditing(true) }}
        className="text-[10px] font-semibold text-go-dark/70 bg-go-dark/[0.05] hover:bg-go-dark/[0.1] px-2 py-0.5 rounded-md"
        title="Reemplazar el link con la versión completa"
      >✏️ Editar link</button>
    )
  }

  return (
    <div className="flex items-center gap-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
      <input
        type="url"
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        placeholder="https://www.tiktok.com/@…/video/…"
        className="text-[11px] px-2 py-0.5 rounded-md border border-go-border bg-white min-w-[220px]"
      />
      <button
        type="button"
        disabled={saving || !draft.trim()}
        onClick={async () => {
          setSaving(true)
          const r = await updateBoostRequest(boostId, { tiktok_url: draft.trim() })
          setSaving(false)
          if (r.error) { onSaved(`Error: ${r.error}`); return }
          onSaved('✅ Link actualizado')
          setEditing(false)
        }}
        className="text-[10px] font-semibold bg-go-orange text-white px-2 py-0.5 rounded-md hover:bg-go-orange/90 disabled:opacity-40"
      >{saving ? 'Guardando…' : 'Guardar'}</button>
      <button
        type="button"
        onClick={() => { setEditing(false); setDraft(url ?? '') }}
        className="text-[10px] font-semibold bg-go-dark/[0.06] text-go-dark/60 px-2 py-0.5 rounded-md"
      >Cancelar</button>
    </div>
  )
}

// ── Invalid-reason modal (shown when admin marks a video invalid) ────

const COMMON_INVALID_REASONS = [
  'No es un video de TikTok GO',
  'Tag incorrecto (blanco, no verde)',
  'Video duplicado',
  'Link no funciona / link corto',
  'No corresponde al tipo (ACC/TTD)',
  'Contenido inapropiado',
]

// Controlled modal: parent owns `reason` so the field state lives in the
// {open, boostId, url, reason} state object the spec describes. Parent also
// owns onConfirm timing — we don't fire any network call until the admin
// clicks "Marcar inválido →".
function InvalidReasonModal({
  tiktokUrl,
  reason,
  onReasonChange,
  onConfirm,
  onClose,
}: {
  tiktokUrl: string | null
  reason: string
  onReasonChange: (next: string) => void
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-[180] bg-black/60 flex items-center justify-center px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-syne font-bold text-lg text-go-dark mb-2">¿Por qué es inválido este video?</h3>
        {tiktokUrl && (
          <a
            href={tiktokUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block font-dm text-xs text-go-orange hover:underline truncate bg-go-light/60 border border-go-border/60 rounded-md px-2 py-1.5 mb-3"
            title={tiktokUrl}
          >
            🔗 {tiktokUrl}
          </a>
        )}
        <p className="font-dm text-xs text-go-dark/60 mb-2">Elige una razón rápida o escribe abajo:</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {COMMON_INVALID_REASONS.map(r => {
            const selected = reason === r
            return (
              <button
                key={r}
                type="button"
                onClick={() => onReasonChange(r)}
                className={`text-[11px] font-semibold px-3 py-1 rounded-full border transition cursor-pointer ${
                  selected
                    ? 'bg-go-orange text-white border-go-orange'
                    : 'bg-white text-go-dark/70 border-go-border hover:border-go-orange/50 hover:text-go-dark'
                }`}
              >{r}</button>
            )
          })}
        </div>
        <label className="block font-dm text-xs font-semibold text-go-dark/60 uppercase tracking-wide mb-1">
          Motivo detallado (opcional)
        </label>
        <textarea
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          placeholder="Escribe el motivo o selecciona uno arriba..."
          rows={3}
          className="w-full border border-go-border rounded-lg px-3 py-2 font-dm text-sm focus:outline-none focus:ring-2 focus:ring-go-orange/30 focus:border-go-orange"
        />
        <div className="flex gap-2 mt-4">
          <button
            onClick={onClose}
            className="flex-1 bg-go-dark/[0.06] text-go-dark/70 font-dm font-semibold text-sm py-2.5 rounded-lg hover:bg-go-dark/[0.1]"
          >Cancelar</button>
          <button
            onClick={onConfirm}
            className="flex-1 bg-red-500 text-white font-dm font-bold text-sm py-2.5 rounded-lg hover:bg-red-600"
          >Marcar inválido →</button>
        </div>
      </div>
    </div>
  )
}

// Short TikTok links (tiktok.com/t/, vm.tiktok.com/) are region/device

// Validity is tri-state. Show only the relevant action button per state.
// The parent decides what each action does — typically "mark valid" runs
// immediately while "mark invalid" opens an InvalidReasonModal.
function ValidityCell({ isValid, onMarkValid, onMarkInvalid }: {
  isValid: boolean | null
  onMarkValid: () => void
  onMarkInvalid: () => void
}) {
  if (isValid === true) {
    return (
      <div className="flex flex-col gap-1 items-start">
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">✅ Válido</span>
        <button
          onClick={onMarkInvalid}
          className="text-[10px] font-semibold text-go-dark/70 bg-go-dark/[0.05] hover:bg-go-dark/[0.1] px-2 py-0.5 rounded-md"
        >↩️ Marcar inválido</button>
      </div>
    )
  }
  if (isValid === false) {
    return (
      <div className="flex flex-col gap-1 items-start">
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">❌ Inválido</span>
        <button
          onClick={onMarkValid}
          className="text-[10px] font-semibold text-go-dark/70 bg-go-dark/[0.05] hover:bg-go-dark/[0.1] px-2 py-0.5 rounded-md"
        >↩️ Marcar válido</button>
      </div>
    )
  }
  // Not reviewed yet: both options
  return (
    <div className="flex flex-col gap-1 items-start">
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">⏳ Sin revisar</span>
      <div className="flex gap-1">
        <button
          onClick={onMarkValid}
          className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
        >✅ Válido</button>
        <button
          onClick={onMarkInvalid}
          className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-red-500 text-white hover:bg-red-600"
        >❌ Inválido</button>
      </div>
    </div>
  )
}

// Boost decision is gated on boost_requested. If the creator didn't ask for
// a boost, admin sees only "Sin solicitud" muted text and no buttons.
function BoostDecisionCell({
  boostStatus, boostRequested, onApprove, onReject,
}: {
  boostStatus: BoostStatus
  boostRequested: boolean
  onApprove: () => void
  onReject: () => void
}) {
  if (!boostRequested) {
    return <span className="font-dm text-[10px] text-go-dark/40">Sin solicitud</span>
  }
  if (boostStatus === 'boosteado') {
    return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">🚀 Boosteado</span>
  }
  if (boostStatus === 'rechazado') {
    return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">✗ Sin boost</span>
  }
  return (
    <div className="flex flex-col gap-1 items-start">
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">🚀 Boost solicitado</span>
      <div className="flex gap-1">
        <button onClick={onApprove} className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-orange-500 text-white hover:bg-orange-600">🚀 Boost</button>
        <button onClick={onReject} className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-gray-200 text-gray-600 hover:bg-gray-300">✗</button>
      </div>
    </div>
  )
}

// ── Boosts Tab ──────────────────────────────────────

function BoostsTab({ boosts, startTransition }: { boosts: BoostRequest[]; startTransition: (fn: () => void) => void }) {
  const router = useRouter()
  const [feedback, setFeedback] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<'all' | 'ACC' | 'TTD'>('all')
  const [editing, setEditing] = useState<{ id: string; url: string; type: 'ACC' | 'TTD' } | null>(null)
  const [preview, setPreview] = useState<{ url: string; boostId: string } | null>(null)
  const [rejectModal, setRejectModal] = useState<{ open: boolean; boostId: string | null; url: string | null; reason: string }>({ open: false, boostId: null, url: null, reason: '' })
  function fb(msg: string) { setFeedback(msg); setTimeout(() => setFeedback(null), 5000) }
  function closeRejectModal() { setRejectModal({ open: false, boostId: null, url: null, reason: '' }) }

  const filtered = typeFilter === 'all' ? boosts : boosts.filter(b => b.video_type === typeFilter)

  return (
    <SectionCard>
      <div className="p-6">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
          <h2 className="font-syne font-bold text-lg text-go-dark">Solicitudes de Boost ({filtered.length})</h2>
          <div className="flex gap-1.5">
            {([['all', 'Todos'], ['ACC', 'ACC'], ['TTD', 'TTD']] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTypeFilter(key)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full font-dm transition ${
                  typeFilter === key
                    ? 'bg-go-orange text-white'
                    : 'bg-go-dark/[0.04] text-go-dark/60 hover:bg-go-dark/[0.08]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <p className="font-dm text-xs text-go-dark/60 bg-go-dark/[0.03] border border-go-dark/[0.06] rounded-lg px-3 py-2 mb-4">
          ℹ️ <strong>Válido</strong> = el video cuenta para la meta mensual de la creadora. <strong>Boost</strong> = decisión separada, si Papaya amplifica el video.
        </p>

        {feedback && <p className={`text-sm font-dm mb-3 px-3 py-2 rounded-lg ${feedback.startsWith('Error') ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>{feedback}</p>}

        <div className="overflow-x-auto rounded-2xl border border-go-dark/5">
          <table className="w-full text-sm font-dm">
            <thead className="bg-go-dark/[0.03]">
              <tr>
                {['Creator', 'TikTok', 'Tipo', 'URL Video', 'Validez', 'Boost', 'Fecha', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs text-go-dark/50 font-semibold uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-go-dark/5">
              {filtered.map(b => (
                <tr key={b.id} className={b.is_valid === true ? 'bg-emerald-50/50' : ''}>
                  <td className="px-4 py-3 font-medium text-go-dark">{b.creator_name ?? '—'}</td>
                  <td className="px-4 py-3 text-go-dark/60 text-xs">{b.tiktok_handle ?? '—'}</td>
                  <td className="px-4 py-3">
                    {b.video_type ? (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${b.video_type === 'ACC' ? 'bg-orange-100 text-orange-700' : 'bg-pink-100 text-pink-700'}`}>
                        {b.video_type}
                      </span>
                    ) : (
                      <span className="text-xs text-go-dark/30">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {(b.tiktok_url || b.video_url) ? (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <a href={b.tiktok_url || b.video_url || '#'} target="_blank" rel="noopener noreferrer" className="text-go-orange hover:underline truncate block max-w-[180px]">
                          {b.tiktok_url || b.video_url}
                        </a>
                        <PreviewButton url={b.tiktok_url || b.video_url} onOpen={() => {
                          const u = b.tiktok_url || b.video_url
                          if (u) setPreview({ url: u, boostId: b.id })
                        }} />
                        <ShortLinkBadge url={b.tiktok_url || b.video_url} />
                        <EditableLinkRow boostId={b.id} url={b.tiktok_url || b.video_url} onSaved={fb} />
                      </div>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <ValidityCell
                      isValid={b.is_valid}
                      onMarkValid={() => startTransition(async () => {
                        const r = await setBoostValidity(b.id, true)
                        if (r.error) fb(`Error: ${r.error}`); else fb('✓ Marcado válido')
                      })}
                      onMarkInvalid={() => {
                        console.log(`Inválido button clicked for boost ID: ${b.id}`)
                        setRejectModal({ open: true, boostId: b.id, url: b.tiktok_url || b.video_url || null, reason: '' })
                      }}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <BoostDecisionCell
                      boostStatus={b.boost_status}
                      boostRequested={!!b.boost_requested}
                      onApprove={() => startTransition(async () => {
                        const r = await setBoostStatus(b.id, 'boosteado')
                        if (r.error) fb(`Error: ${r.error}`); else fb('✓ Boost aprobado')
                      })}
                      onReject={() => {
                        const reason = prompt('Razón para no boostear (visible para la creadora):') ?? ''
                        if (!reason.trim()) return
                        startTransition(async () => {
                          const r = await setBoostStatus(b.id, 'rechazado', reason)
                          if (r.error) fb(`Error: ${r.error}`); else fb('✓ Boost rechazado')
                        })
                      }}
                    />
                  </td>
                  <td className="px-4 py-3 text-go-dark/40 text-xs">{new Date(b.created_at).toLocaleDateString('es')}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setEditing({ id: b.id, url: b.tiktok_url ?? '', type: (b.video_type ?? 'ACC') as 'ACC' | 'TTD' })}
                      className="text-[10px] font-semibold text-go-dark/70 bg-go-dark/[0.05] hover:bg-go-dark/[0.1] px-2 py-1 rounded-md"
                    >✏️ Editar</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-go-dark/40">No hay solicitudes de boost.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* TikTok preview modal */}
      <TikTokPreviewModal
        url={preview?.url ?? null}
        onClose={() => setPreview(null)}
      />

      {/* Invalid-reason modal */}
      {rejectModal.open && (
        <InvalidReasonModal
          tiktokUrl={rejectModal.url}
          reason={rejectModal.reason}
          onReasonChange={(next) => setRejectModal((m) => ({ ...m, reason: next }))}
          onClose={closeRejectModal}
          onConfirm={() => {
            const { boostId, reason } = rejectModal
            if (!boostId) return
            startTransition(async () => {
              const r = await setBoostInvalid(boostId, reason.trim())
              if (r.error) { fb(`Error: ${r.error}`); return }
              fb('❌ Video marcado como inválido')
              closeRejectModal()
              router.refresh()
            })
          }}
        />
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-[180] bg-black/60 flex items-center justify-center px-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-syne font-bold text-lg text-go-dark mb-4">Editar video</h3>
            <label className="block font-dm text-xs font-semibold text-go-dark/60 uppercase tracking-wide mb-1">TikTok URL</label>
            <input
              type="url"
              value={editing.url}
              onChange={(e) => setEditing({ ...editing, url: e.target.value })}
              className="w-full border border-go-border rounded-lg px-3 py-2 font-dm text-sm focus:outline-none focus:ring-2 focus:ring-go-orange/30 focus:border-go-orange"
            />
            <label className="block font-dm text-xs font-semibold text-go-dark/60 uppercase tracking-wide mt-4 mb-1">Tipo de video</label>
            <div className="flex gap-2">
              {(['ACC', 'TTD'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setEditing({ ...editing, type: t })}
                  className={`flex-1 py-2 rounded-lg font-dm font-semibold text-sm border-2 transition ${editing.type === t ? 'bg-go-orange text-white border-go-orange' : 'bg-white text-go-dark/60 border-go-border'}`}
                >{t}</button>
              ))}
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => startTransition(async () => {
                  if (!editing) return
                  const r = await updateBoostRequest(editing.id, { tiktok_url: editing.url, video_type: editing.type })
                  if (r.error) fb(`Error: ${r.error}`)
                  else { fb('✅ Video actualizado correctamente'); setEditing(null) }
                })}
                className="flex-1 bg-go-orange text-white font-dm font-semibold text-sm py-2.5 rounded-lg hover:bg-go-orange/90"
              >Guardar cambios</button>
              <button
                onClick={() => setEditing(null)}
                className="flex-1 bg-go-dark/[0.06] text-go-dark/70 font-dm font-semibold text-sm py-2.5 rounded-lg hover:bg-go-dark/[0.1]"
              >Cancelar</button>
            </div>
          </div>
        </div>
      )}
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
                  <td className="px-4 py-3 text-go-dark/50 text-xs max-w-[200px]">
                    {r.notes ? (
                      (() => {
                        try {
                          const parsed = JSON.parse(r.notes)
                          return (
                            <span className="flex items-center gap-1">
                              <span className="truncate">Formulario</span>
                              <button type="button" onClick={() => alert(Object.entries(parsed).map(([k, v]) => `${k}: ${v}`).join('\n'))} className="text-go-orange font-semibold hover:underline shrink-0">Ver</button>
                            </span>
                          )
                        } catch {
                          return <span className="truncate block">{r.notes}</span>
                        }
                      })()
                    ) : '—'}
                  </td>
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

// Plan Semanal tab archived. WeeklyPlanTab removed — go_weekly_plan_items
// stays in the DB, server actions still exist, just no UI surface.

// ── Challenges Tab ───────────────────────────────────

function ChallengesTab({ challenges, startTransition }: { challenges: Challenge[]; startTransition: (fn: () => void) => void }) {
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', challenge_type: 'most_videos', prize: '', prize_description: '', start_date: '', end_date: '' })
  const [feedback, setFeedback] = useState<string | null>(null)
  const fb = (msg: string) => { setFeedback(msg); setTimeout(() => setFeedback(null), 4000) }

  return (
    <SectionCard>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-syne font-bold text-lg text-go-dark">Retos ({challenges.length})</h2>
          <ActionButton onClick={() => setShowAdd(!showAdd)}>{showAdd ? 'Cancelar' : '+ Nuevo reto'}</ActionButton>
        </div>
        {feedback && <p className={`text-sm font-dm mb-3 px-3 py-2 rounded-lg ${feedback.startsWith('Error') ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>{feedback}</p>}

        {showAdd && (
          <div className="bg-go-light border border-go-border rounded-2xl p-4 mb-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className="block text-xs font-medium text-gray-500 mb-1">Título</label><input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="input-field" placeholder='Ej: Reina del ACC 👑' /></div>
              <div className="col-span-2"><label className="block text-xs font-medium text-gray-500 mb-1">Descripción</label><textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="input-field" rows={2} /></div>
              <div><label className="block text-xs font-medium text-gray-500 mb-1">Tipo</label>
                <select value={form.challenge_type} onChange={e => setForm(f => ({ ...f, challenge_type: e.target.value }))} className="input-field">
                  {Object.entries(CHALLENGE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div><label className="block text-xs font-medium text-gray-500 mb-1">Premio</label><input value={form.prize} onChange={e => setForm(f => ({ ...f, prize: e.target.value }))} className="input-field" placeholder="1 noche gratis" /></div>
              <div><label className="block text-xs font-medium text-gray-500 mb-1">Fecha inicio</label><input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className="input-field" /></div>
              <div><label className="block text-xs font-medium text-gray-500 mb-1">Fecha fin</label><input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} className="input-field" /></div>
            </div>
            <button disabled={!form.title || !form.start_date || !form.end_date} onClick={() => startTransition(async () => {
              const r = await addChallenge({ title: form.title, description: form.description || null, challenge_type: form.challenge_type, prize: form.prize || null, prize_description: form.prize_description || null, start_date: form.start_date, end_date: form.end_date })
              if (r.error) fb(`Error: ${r.error}`)
              else { fb('✓ Reto creado'); setForm({ title: '', description: '', challenge_type: 'most_videos', prize: '', prize_description: '', start_date: '', end_date: '' }); setShowAdd(false) }
            })} className="mt-3 font-dm text-sm font-semibold bg-go-orange text-white px-4 py-2 rounded-xl disabled:opacity-50">Guardar</button>
          </div>
        )}

        <div className="space-y-3">
          {challenges.map(ch => (
            <div key={ch.id} className={`border rounded-2xl p-4 flex items-center gap-4 ${ch.is_active ? 'border-[#ff7700]/40 bg-[#ff7700]/5' : 'border-go-dark/5'}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-syne font-bold text-sm text-go-dark">{ch.title}</span>
                  <span className="font-dm text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">{CHALLENGE_TYPE_LABELS[ch.challenge_type] ?? ch.challenge_type}</span>
                  {ch.is_active && <span className="font-dm text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#ff7700] text-white">ACTIVO</span>}
                </div>
                {ch.prize && <p className="font-dm text-xs text-gray-500">🎁 {ch.prize}</p>}
                <p className="font-dm text-xs text-gray-400">{ch.start_date} → {ch.end_date}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => startTransition(async () => { await toggleChallenge(ch.id, !ch.is_active); fb('✓') })} className={`text-xs font-semibold px-2 py-1 rounded-full ${ch.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
                  {ch.is_active ? 'Activo' : 'Inactivo'}
                </button>
                <button onClick={() => { if (confirm('¿Eliminar?')) startTransition(async () => { await deleteChallenge(ch.id); fb('✓ Eliminado') }) }} className="text-xs text-red-400 hover:text-red-600">Eliminar</button>
              </div>
            </div>
          ))}
          {challenges.length === 0 && <p className="text-center text-gray-400 py-6 font-dm text-sm">No hay retos configurados.</p>}
        </div>
      </div>
    </SectionCard>
  )
}

// Plan Global tab archived alongside Plan Semanal — GlobalPlanTab removed
// from the UI; applyGlobalPlan stays exported on the server for re-enable.

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
  nivelRequirements,
  boostRequests,
  rewardRequests,
  challenges,
  tiktokAccounts,
  internalVideos,
  monthlyGoal,
  monthlySnapshots,
  creatorSnapshots,
  levelUpEvents,
  topPois,
  currentMonth,
  currentYear,
}: AdminPanelProps) {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [isPending, startTransition] = useTransition()

  const pendingInternalCount = internalVideos.filter(v => v.status === 'pending').length

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'dashboard', label: '📊 Dashboard', count: 0 },
    { key: 'crecimiento', label: '📈 Crecimiento', count: monthlySnapshots.length },
    { key: 'creators', label: 'Creators', count: creators.length },
    { key: 'pois', label: 'POIs', count: pois.length },
    { key: 'top-pois', label: '📍 Top POIs', count: topPois.length },
    { key: 'templates', label: 'CapCut Templates', count: templates.length },
    { key: 'announcements', label: 'Announcements', count: announcements.length },
    { key: 'portfolios', label: 'Portfolios', count: portfolios.length },
    { key: 'viral', label: 'Videos Virales', count: viralVideos.length },
    { key: 'poi-requests', label: 'Solicitudes', count: poiRequests.length },
    { key: 'rewards-admin', label: '🎁 Rewards', count: nivelRewards.length },
    { key: 'boosts', label: '🚀 Boosts', count: boostRequests.length },
    { key: 'reward-requests', label: '🎀 Reward Requests', count: rewardRequests.length },
    { key: 'challenges', label: '🏆 Retos', count: challenges.length },
    { key: 'tiktok-accounts', label: '📱 Cuentas TikTok', count: tiktokAccounts.length },
    { key: 'internal-videos', label: '🎬 Videos Internos', count: pendingInternalCount },
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

        {tab === 'dashboard' && (
          <AdminDashboardTab
            creators={creators}
            internalVideos={internalVideos}
            boostRequests={boostRequests}
            creatorSnapshots={creatorSnapshots}
            levelUpEvents={levelUpEvents}
            monthlyGoal={monthlyGoal}
            currentMonth={currentMonth}
            currentYear={currentYear}
            startTransition={startTransition}
          />
        )}
        {tab === 'crecimiento' && (
          <CrecimientoTab
            monthlySnapshots={monthlySnapshots}
            creators={creators}
            internalVideos={internalVideos}
            boostRequests={boostRequests}
            monthlyGoal={monthlyGoal}
            currentMonth={currentMonth}
            currentYear={currentYear}
            startTransition={startTransition}
          />
        )}
        {tab === 'creators' && (
          <CreatorsTab creators={creators} boostRequests={boostRequests} creatorSnapshots={creatorSnapshots} levelUpEvents={levelUpEvents} currentMonth={currentMonth} currentYear={currentYear} startTransition={startTransition} />
        )}
        {tab === 'pois' && <POIsTab pois={pois} startTransition={startTransition} />}
        {tab === 'top-pois' && <TopPoisTab topPois={topPois} startTransition={startTransition} />}
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
        {tab === 'rewards-admin' && <NivelRewardsTab rewards={nivelRewards} requirements={nivelRequirements} startTransition={startTransition} />}
        {tab === 'boosts' && <BoostsTab boosts={boostRequests} startTransition={startTransition} />}
        {tab === 'reward-requests' && <RewardRequestsTab requests={rewardRequests} startTransition={startTransition} />}
        {tab === 'challenges' && <ChallengesTab challenges={challenges} startTransition={startTransition} />}
        {tab === 'tiktok-accounts' && <TikTokAccountsTab accounts={tiktokAccounts} startTransition={startTransition} />}
        {tab === 'internal-videos' && <InternalVideosTab videos={internalVideos} creators={creators} startTransition={startTransition} />}
      </main>
    </div>
  )
}

// ── Creators Tab ──────────────────────────────────────

type ActivityStatus = 'inactive' | 'risk' | 'active' | 'no_quota'

// Anchored on real video activity, not on weekly_quota. The previous version
// returned 'no_quota' for every creator without a quota set, which made the
// Activa / En riesgo / Inactiva buckets read 0 even when creators were
// posting. Quota only decides Sin cuota vs Inactiva when there's nothing
// this month to look at.
//
// Rules:
//   Activa     — status='active' AND ≥1 video this month
//                (En riesgo overrides when 0 in the last 7 days)
//   En riesgo  — status='active' AND ≥1 video this month AND 0 last 7 days
//   Inactiva   — status='active' AND 0 this month AND weekly_quota > 0
//   Sin cuota  — fallback: 0 this month AND no weekly_quota,
//                or status != 'active' (pending/suspended)
function classifyCreatorActivity(
  c: Creator,
  thisMonth: number,
  last7Days: number,
): ActivityStatus {
  if (c.status !== 'active') return 'no_quota'
  if (thisMonth === 0) {
    if (!c.weekly_quota || c.weekly_quota <= 0) return 'no_quota'
    return 'inactive'
  }
  if (last7Days === 0) return 'risk'
  return 'active'
}

function CreatorsTab({
  creators,
  boostRequests,
  creatorSnapshots,
  levelUpEvents,
  currentMonth,
  currentYear,
  startTransition,
}: {
  creators: Creator[]
  boostRequests: BoostRequest[]
  creatorSnapshots: CreatorSnapshot[]
  levelUpEvents: LevelUpEvent[]
  currentMonth: number
  currentYear: number
  startTransition: (cb: () => void) => void
}) {
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editData, setEditData] = useState<Record<string, string | number>>({})
  const [feedback, setFeedback] = useState<string | null>(null)
  const fb = (msg: string) => { setFeedback(msg); setTimeout(() => setFeedback(null), 5000) }
  const [strategyId, setStrategyId] = useState<string | null>(null)
  const [submittingForCreatorId, setSubmittingForCreatorId] = useState<string | null>(null)
  const [strategyForm, setStrategyForm] = useState({ acc_goal: '', ttd_goal: '', gmv_goal: '', special_hashtags: '', creative_brief: '', daily_quota: '', weekly_quota: '', monthly_quota: '' })
  // Plan Semanal feature is archived — state removed; planSlots/applyToAll/
  // planLoading no longer surfaced in the modal.
  const [internalStats, setInternalStats] = useState<{ today: number; week: number; month: number } | null>(null)

  // Add form state
  const [newEmail, setNewEmail] = useState('')
  const [newName, setNewName] = useState('')
  const [newTiktok, setNewTiktok] = useState('')

  // Activity filter
  const [activityFilter, setActivityFilter] = useState<'all' | ActivityStatus>('all')

  // Per-creator boost-request derivations
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString()
  const startOfMonth = new Date(currentYear, currentMonth - 1, 1).toISOString()

  const lastSnapshotByCreator = new Map<string, CreatorSnapshot>()
  const prevDate = new Date(currentYear, currentMonth - 2, 1)
  const prevMonth = prevDate.getMonth() + 1
  const prevYear = prevDate.getFullYear()
  for (const s of creatorSnapshots) {
    if (s.month === prevMonth && s.year === prevYear) lastSnapshotByCreator.set(s.creator_id, s)
  }

  const derived = creators.map((c) => {
    const mine = boostRequests.filter((b) => b.creator_id === c.id)
    const last7 = mine.filter((b) => b.created_at >= sevenDaysAgo).length
    const thisMonthRows = mine.filter((b) => b.created_at >= startOfMonth)
    const thisMonth = thisMonthRows.length
    // Live counts — go_creators.acc_this_month / ttd_this_month / videos_this_month
    // are leaderboard-only. The columns here read from boost_requests so they
    // can't drift if a counter bump fails.
    const accLive = thisMonthRows.filter(b => b.video_type === 'ACC' && b.is_valid === true).length
    const ttdLive = thisMonthRows.filter(b => b.video_type === 'TTD' && b.is_valid === true).length
    const pendingLive = thisMonthRows.filter(b => b.is_valid == null).length
    const status = classifyCreatorActivity(c, thisMonth, last7)
    const snap = lastSnapshotByCreator.get(c.id)
    const lastTotal = snap ? snap.total_videos : null
    const monthDelta = lastTotal == null ? null : thisMonth - lastTotal
    return { creator: c, status, thisMonth, monthDelta, accLive, ttdLive, pendingLive }
  })

  const visibleCreators = activityFilter === 'all' ? derived : derived.filter((d) => d.status === activityFilter)

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
    const original = creators.find(c => c.id === id)
    const newNivel = Number(editData.nivel)
    const nivelChanged = !!original && original.nivel !== newNivel
    if (nivelChanged) {
      const ok = confirm(`¿Confirmas? Esto reiniciará el contador de videos de este mes para ${original.full_name ?? original.email}.`)
      if (!ok) return
    }
    startTransition(async () => {
      // Other fields go through the regular update path. If the nivel
      // changed, updateCreatorNivel takes care of nivel + monthly counter
      // reset atomically afterward.
      await updateCreator(id, {
        nivel: newNivel,
        gmv_total: Number(editData.gmv_total),
        acc_this_month: Number(editData.acc_this_month),
        ttd_this_month: Number(editData.ttd_this_month),
        videos_this_month: Number(editData.videos_this_month),
        status: editData.status as Creator['status'],
      })
      if (nivelChanged) {
        await updateCreatorNivel(id, newNivel)
      }
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
      {submittingForCreatorId && (
        <AdminVideoSubmitModal
          creators={creators}
          defaultCreatorId={submittingForCreatorId}
          onClose={() => setSubmittingForCreatorId(null)}
          startTransition={startTransition}
        />
      )}
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

      {/* Activity filter */}
      <div className="flex flex-wrap gap-1.5">
        {([
          ['all', `Todas (${derived.length})`],
          ['active', `✅ Activas (${derived.filter(d => d.status === 'active').length})`],
          ['risk', `📉 En riesgo (${derived.filter(d => d.status === 'risk').length})`],
          ['inactive', `⚠️ Inactivas (${derived.filter(d => d.status === 'inactive').length})`],
          ['no_quota', `Sin cuota (${derived.filter(d => d.status === 'no_quota').length})`],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActivityFilter(key)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full font-dm transition ${
              activityFilter === key ? 'bg-go-orange text-white' : 'bg-go-dark/[0.04] text-go-dark/60 hover:bg-go-dark/[0.08]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

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
                <th className="text-right px-4 py-3 font-medium text-go-dark/60">Total</th>
                <th className="text-right px-4 py-3 font-medium text-go-dark/60">Pend.</th>
                <th className="text-left px-4 py-3 font-medium text-go-dark/60">Actividad</th>
                <th className="text-left px-4 py-3 font-medium text-go-dark/60">vs mes pasado</th>
                <th className="text-left px-4 py-3 font-medium text-go-dark/60">Status</th>
                <th className="text-left px-4 py-3 font-medium text-go-dark/60">Código</th>
                <th className="text-right px-4 py-3 font-medium text-go-dark/60">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visibleCreators.map(({ creator: c, status: activity, monthDelta, accLive, ttdLive, pendingLive }) => (
                <tr key={c.id} className="border-b border-go-border/50 hover:bg-go-light/30">
                  <td className="px-4 py-3 font-medium text-go-dark">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span>{c.full_name ?? '—'}</span>
                      {c.is_internal && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-go-orange/15 text-go-orange uppercase tracking-wide">Interna</span>
                      )}
                    </div>
                  </td>
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
                        {Number(editData.nivel) !== c.nivel && (
                          <p className="font-dm text-[10px] text-amber-700 mt-1 max-w-[160px]">
                            ⚠️ Cambiar el nivel reiniciará el contador mensual.
                          </p>
                        )}
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
                      <td className="px-4 py-3 text-right" title="Stored leaderboard counter for the Total column — edit to fix drift">
                        <input
                          type="number"
                          value={editData.videos_this_month}
                          onChange={(e) => setEditData({ ...editData, videos_this_month: e.target.value })}
                          className="w-16 px-1 py-1 text-xs rounded border border-go-border text-right"
                        />
                      </td>
                      {/* Pend / Activity / vs mes pasado / Código — read-only when editing. */}
                      <td className="px-4 py-3 text-xs text-gray-300 text-right">—</td>
                      <td className="px-4 py-3 text-xs text-gray-300">—</td>
                      <td className="px-4 py-3 text-xs text-gray-300">—</td>
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
                      <td className="px-4 py-3 text-xs text-gray-300">—</td>
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
                      <td className="px-4 py-3 text-right font-mono text-go-dark/70" title="Aprobados este mes (live)">
                        {accLive}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-go-dark/70" title="Aprobados este mes (live)">
                        {ttdLive}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-go-dark" title="ACC + TTD aprobados (live)">
                        {accLive + ttdLive}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-amber-700/80" title="Sin revisar (is_valid IS NULL)">
                        {pendingLive || ''}
                      </td>
                      <td className="px-4 py-3">
                        {activity === 'inactive' && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">⚠️ Inactiva</span>}
                        {activity === 'risk' && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">📉 En riesgo</span>}
                        {activity === 'active' && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">✅ Activa</span>}
                        {activity === 'no_quota' && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Sin cuota</span>}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {monthDelta == null ? <span className="text-gray-300">—</span>
                          : monthDelta > 0 ? <span className="font-bold text-emerald-700">▲ {monthDelta} videos más</span>
                          : monthDelta < 0 ? <span className="font-bold text-red-600">▼ {Math.abs(monthDelta)} videos menos</span>
                          : <span className="text-gray-500 font-semibold">= Sin cambio</span>}
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
                        <ActionButton
                          variant="ghost"
                          onClick={() => startTransition(async () => {
                            const r = await toggleCreatorInternal(c.id, !c.is_internal)
                            if (r.error) fb(`Error: ${r.error}`)
                            else fb(c.is_internal ? '✓ Marcada como creadora regular' : '✓ Marcada como Creadora Interna')
                          })}
                        >
                          {c.is_internal ? '✓ Interna' : '○ Hacer Interna'}
                        </ActionButton>
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
                            daily_quota: String(c.daily_quota ?? ''),
                            weekly_quota: String(c.weekly_quota ?? ''),
                            monthly_quota: String(c.monthly_quota ?? ''),
                          })
                          setInternalStats(null)
                          if (c.is_internal) {
                            getInternalVideoStats(c.id).then(s => {
                              setInternalStats({ today: s.today, week: s.week, month: s.month })
                            })
                          }
                        }}>
                          Estrategia
                        </ActionButton>
                        <ActionButton variant="ghost" onClick={() => setSubmittingForCreatorId(c.id)}>
                          🎬 Agregar Videos
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

          {/* Cuota de videos (creadoras internas) */}
          {creators.find(c => c.id === strategyId)?.is_internal && (
            <div className="mt-4 pt-4 border-t border-go-border">
              <h4 className="font-syne font-bold text-sm text-go-dark mb-3">🎬 Cuota de videos (Creadora Interna)</h4>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Videos por día</label>
                  <input type="number" min="0" value={strategyForm.daily_quota} onChange={e => setStrategyForm(f => ({...f, daily_quota: e.target.value}))} className="w-full px-3 py-2 rounded-lg border border-go-border bg-go-light text-sm font-dm text-go-dark focus:outline-none focus:ring-2 focus:ring-go-orange/30 focus:border-go-orange transition" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Videos por semana</label>
                  <input type="number" min="0" value={strategyForm.weekly_quota} onChange={e => setStrategyForm(f => ({...f, weekly_quota: e.target.value}))} className="w-full px-3 py-2 rounded-lg border border-go-border bg-go-light text-sm font-dm text-go-dark focus:outline-none focus:ring-2 focus:ring-go-orange/30 focus:border-go-orange transition" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Videos por mes</label>
                  <input type="number" min="0" value={strategyForm.monthly_quota} onChange={e => setStrategyForm(f => ({...f, monthly_quota: e.target.value}))} className="w-full px-3 py-2 rounded-lg border border-go-border bg-go-light text-sm font-dm text-go-dark focus:outline-none focus:ring-2 focus:ring-go-orange/30 focus:border-go-orange transition" />
                </div>
              </div>

              {internalStats && (
                <div className="grid grid-cols-3 gap-3 mt-4">
                  {([
                    { label: 'Hoy', count: internalStats.today, quota: parseInt(strategyForm.daily_quota) || 0 },
                    { label: 'Esta semana', count: internalStats.week, quota: parseInt(strategyForm.weekly_quota) || 0 },
                    { label: 'Este mes', count: internalStats.month, quota: parseInt(strategyForm.monthly_quota) || 0 },
                  ]).map(s => (
                    <div key={s.label} className="bg-white rounded-xl border border-go-border p-3">
                      <p className="font-dm text-[10px] uppercase tracking-wide text-go-dark/40">{s.label}</p>
                      <p className="font-syne font-bold text-2xl text-go-dark mt-0.5">
                        {s.count}<span className="text-go-dark/30 text-sm font-normal"> / {s.quota}</span>
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Plan Semanal section archived — see go_content_plan table. */}
          {/* Level-up history for this creator */}
          {(() => {
            const myEvents = levelUpEvents.filter(e => e.creator_id === strategyId)
            if (myEvents.length === 0) return null
            return (
              <div className="mt-4 pt-4 border-t border-go-border">
                <h4 className="font-syne font-bold text-sm text-go-dark mb-3">📈 Historial de niveles</h4>
                <div className="overflow-x-auto rounded-xl border border-go-border">
                  <table className="w-full text-xs font-dm">
                    <thead className="bg-go-dark/[0.03]">
                      <tr>{['Fecha', 'De', 'A', 'ACC carry', 'TTD carry', 'Total carry'].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-[10px] text-go-dark/50 font-semibold uppercase">{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody className="divide-y divide-go-border/50">
                      {myEvents.map(e => (
                        <tr key={e.id}>
                          <td className="px-3 py-2 text-go-dark/60">{new Date(e.leveled_up_at).toLocaleDateString('es')}</td>
                          <td className="px-3 py-2">N{e.from_nivel} {NIVEL_NAMES[e.from_nivel]}</td>
                          <td className="px-3 py-2 font-semibold text-go-orange">N{e.to_nivel} {NIVEL_NAMES[e.to_nivel]}</td>
                          <td className="px-3 py-2">{e.carry_acc}</td>
                          <td className="px-3 py-2">{e.carry_ttd}</td>
                          <td className="px-3 py-2 font-bold text-go-dark">{e.carry_total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })()}

          <div className="flex gap-2 mt-3">
            <button onClick={() => startTransition(async () => {
              const r = await updateCreatorStrategy(strategyId, {
                acc_goal: parseInt(strategyForm.acc_goal) || undefined,
                ttd_goal: parseInt(strategyForm.ttd_goal) || undefined,
                gmv_goal: parseInt(strategyForm.gmv_goal) || undefined,
                special_hashtags: strategyForm.special_hashtags || null,
                creative_brief: strategyForm.creative_brief || null,
                daily_quota: parseInt(strategyForm.daily_quota) || 0,
                weekly_quota: parseInt(strategyForm.weekly_quota) || 0,
                monthly_quota: parseInt(strategyForm.monthly_quota) || 0,
              })
              if (r.error) { fb(`Error: ${r.error}`); return }
              fb('✓ Estrategia guardada')
              setStrategyId(null)
            })} className="font-dm text-sm font-semibold bg-go-orange text-white px-4 py-2 rounded-xl">Guardar</button>
            <button onClick={() => setStrategyId(null)} className="font-dm text-sm text-gray-500 px-4 py-2">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Top POIs Tab (Google Sheets sync) ─────────────────

function TopPoisTab({
  topPois,
  startTransition,
}: {
  topPois: TopPoi[]
  startTransition: (cb: () => void) => void
}) {
  const [feedback, setFeedback] = useState<string | null>(null)
  const [syncingType, setSyncingType] = useState<'ACC' | 'TTD' | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editRank, setEditRank] = useState('')
  function fb(msg: string) { setFeedback(msg); setTimeout(() => setFeedback(null), 5000) }

  function handleSync(type: 'ACC' | 'TTD') {
    setSyncingType(type)
    startTransition(async () => {
      const r = await syncTopPois(type)
      setSyncingType(null)
      if (r.error) {
        fb(`Error: ${r.error}`)
        return
      }
      const dupeNote = r.removedDuplicates && r.removedDuplicates > 0
        ? ` · ${r.removedDuplicates} duplicado${r.removedDuplicates === 1 ? '' : 's'} ignorado${r.removedDuplicates === 1 ? '' : 's'}`
        : ''
      fb(`✅ ${r.count} lugares ${type} sincronizados (reemplazó datos anteriores)${dupeNote}`)
    })
  }

  function Section({ type, label }: { type: 'ACC' | 'TTD'; label: string }) {
    const rows = topPois.filter(p => p.poi_type === type).sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999))
    return (
      <SectionCard>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h3 className="font-syne font-bold text-base text-go-dark">{label} ({rows.length})</h3>
            <button
              onClick={() => handleSync(type)}
              disabled={syncingType === type}
              className="text-xs font-syne font-bold bg-go-orange text-white px-3 py-1.5 rounded-lg hover:bg-go-orange/90 disabled:opacity-50"
            >
              {syncingType === type ? 'Sincronizando…' : `🔄 Sync Top ${type} desde Google Sheets`}
            </button>
          </div>
          {rows.length === 0 ? (
            <p className="text-xs text-go-dark/40 py-6 text-center">Sin lugares todavía. Sincroniza desde el Sheet.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-go-dark/5">
              <table className="w-full text-sm font-dm">
                <thead className="bg-go-dark/[0.03]">
                  <tr>{['Rank', 'Nombre', 'County', 'POI ID', 'Activo', ''].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-[10px] text-go-dark/50 font-semibold uppercase">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-go-dark/5">
                  {rows.map(p => (
                    <tr key={p.id}>
                      <td className="px-3 py-2 w-16">
                        {editingId === p.id ? (
                          <input
                            type="number"
                            value={editRank}
                            onChange={(e) => setEditRank(e.target.value)}
                            onBlur={() => {
                              const next = parseInt(editRank, 10)
                              if (!Number.isNaN(next)) {
                                startTransition(async () => {
                                  const r = await updateTopPoi(p.id, { rank: next })
                                  if (r.error) fb(`Error: ${r.error}`)
                                  else fb('✓ Rank actualizado')
                                })
                              }
                              setEditingId(null)
                            }}
                            autoFocus
                            className="w-14 px-2 py-1 text-xs border border-go-border rounded"
                          />
                        ) : (
                          <button
                            onClick={() => { setEditingId(p.id); setEditRank(String(p.rank ?? '')) }}
                            className="text-go-orange font-syne font-bold"
                          >#{p.rank ?? '—'}</button>
                        )}
                      </td>
                      <td className="px-3 py-2 font-medium text-go-dark">{p.name}</td>
                      <td className="px-3 py-2 text-go-dark/60">{p.county ?? '—'}</td>
                      <td className="px-3 py-2 text-go-dark/40 text-xs font-mono">{p.poi_id ?? '—'}</td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => startTransition(async () => {
                            const r = await updateTopPoi(p.id, { is_active: !p.is_active })
                            if (r.error) fb(`Error: ${r.error}`); else fb('✓ Estado actualizado')
                          })}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}
                        >{p.is_active ? 'Activo' : 'Inactivo'}</button>
                      </td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => {
                            if (!confirm(`¿Eliminar "${p.name}"?`)) return
                            startTransition(async () => {
                              const r = await deleteTopPoi(p.id)
                              if (r.error) fb(`Error: ${r.error}`); else fb('✓ Eliminado')
                            })
                          }}
                          className="text-xs text-red-400 hover:text-red-600"
                        >×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </SectionCard>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-syne text-2xl font-bold text-go-dark">📍 Top POIs</h2>
        <p className="font-dm text-sm text-go-dark/50 mt-1">
          Sincroniza los rankings de hoteles (ACC) y atracciones (TTD) desde Google Sheets.
          Los inactivos no aparecen en /inspiracion.
        </p>
      </div>
      {feedback && (
        <p className={`text-sm font-dm px-3 py-2 rounded-lg ${feedback.startsWith('Error') ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>
          {feedback}
        </p>
      )}
      <Section type="ACC" label="🏨 Top Hoteles (ACC)" />
      <Section type="TTD" label="🎡 Top Atracciones (TTD)" />
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
  const [editId, setEditId] = useState<string | null>(null)
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
    poi_category: 'viral',
    is_viral_poi: 'false',
    papaya_visited: 'false',
  })

  const emptyForm = {
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
    poi_category: 'viral',
    is_viral_poi: 'false',
    papaya_visited: 'false',
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const data = {
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
        poi_category: form.poi_category,
        is_viral_poi: form.is_viral_poi === 'true',
        papaya_visited: form.papaya_visited === 'true',
      }
      if (editId) {
        await updatePOI(editId, data)
      } else {
        await addPOI(data)
      }
      setShowAdd(false)
      setEditId(null)
      setForm(emptyForm)
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-syne text-lg font-bold text-go-dark">Puntos de Interes</h2>
        <div className="flex gap-2">
          <ActionButton onClick={() => { setShowAdd(!showAdd); if (showAdd) { setEditId(null); setForm(emptyForm) } }}>
            {showAdd ? 'Cancelar' : '+ Agregar POI'}
          </ActionButton>
          {showAdd && editId && (
            <ActionButton variant="ghost" onClick={() => { setEditId(null); setForm(emptyForm) }}>
              Cancelar edicion
            </ActionButton>
          )}
        </div>
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
            <FormSelect label="Categoria" value={form.poi_category} options={[{value:'viral',label:'Viral'},{value:'papaya_visit',label:'Papaya Visit'}]} onChange={v => setForm({...form, poi_category: v})} />
            <label className="flex items-center gap-2 font-dm text-sm"><input type="checkbox" checked={form.is_viral_poi === 'true'} onChange={e => setForm({...form, is_viral_poi: String(e.target.checked)})} className="accent-go-orange" /> Viral POI</label>
            <label className="flex items-center gap-2 font-dm text-sm"><input type="checkbox" checked={form.papaya_visited === 'true'} onChange={e => setForm({...form, papaya_visited: String(e.target.checked)})} className="accent-go-orange" /> Papaya Visit</label>
            <div className="sm:col-span-3">
              <button type="submit" className="px-4 py-2 rounded-lg bg-go-orange text-white text-sm font-medium hover:bg-go-orange/90 transition">
                {editId ? 'Guardar cambios' : 'Agregar POI'}
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
                  <td className="px-4 py-3 text-right flex gap-2 justify-end">
                    <ActionButton
                      variant="ghost"
                      onClick={() => {
                        setEditId(p.id)
                        setShowAdd(true)
                        setForm({
                          name: p.name,
                          type: p.type,
                          city: p.city,
                          state: p.state,
                          commission: p.commission,
                          perk: p.perk ?? '',
                          min_nivel: String(p.min_nivel),
                          capcut_template_url: p.capcut_template_url ?? '',
                          image_emoji: p.image_emoji ?? '',
                          cta_label: p.cta_label ?? '',
                          cta_url: p.cta_url ?? '',
                          poi_category: p.poi_category ?? 'viral',
                          is_viral_poi: String(p.is_viral_poi ?? false),
                          papaya_visited: String(p.papaya_visited ?? false),
                        })
                      }}
                    >
                      Editar
                    </ActionButton>
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
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [displayType, setDisplayType] = useState<'banner' | 'popup'>('banner')
  const [uploadingImg, setUploadingImg] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const fb = (msg: string) => { setFeedback(msg); setTimeout(() => setFeedback(null), 4000) }

  function resetForm() {
    setEditId(null)
    setMessage('')
    setImageUrl('')
    setDisplayType('banner')
    setShowForm(false)
  }

  function startEdit(a: Announcement) {
    setEditId(a.id)
    setMessage(a.message)
    setImageUrl(a.image_url || '')
    setDisplayType(a.display_type || 'banner')
    setShowForm(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim()) return
    startTransition(async () => {
      if (editId) {
        const r = await updateAnnouncement(editId, { message: message.trim(), image_url: imageUrl.trim() || null, display_type: displayType })
        if (r.error) fb(`Error: ${r.error}`)
        else fb('✓ Anuncio actualizado')
      } else {
        await setAnnouncement(message.trim(), imageUrl.trim() || undefined, displayType)
        fb('✓ Anuncio publicado')
      }
      resetForm()
    })
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingImg(true)
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const path = `announcements/${Date.now()}-${file.name}`
      const { error } = await supabase.storage.from('announcements').upload(path, file, { upsert: true })
      if (error) { fb(`Error subiendo: ${error.message}`); return }
      const { data } = supabase.storage.from('announcements').getPublicUrl(path)
      setImageUrl(data.publicUrl)
    } catch { fb('Error subiendo imagen') } finally { setUploadingImg(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-syne text-lg font-bold text-go-dark">Anuncios ({announcements.length})</h2>
        <ActionButton onClick={() => { if (showForm) resetForm(); else setShowForm(true) }}>
          {showForm ? 'Cancelar' : '+ Nuevo anuncio'}
        </ActionButton>
      </div>

      {feedback && <p className={`text-sm font-dm px-3 py-2 rounded-lg ${feedback.startsWith('Error') ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>{feedback}</p>}

      {showForm && (
        <SectionCard>
          <form onSubmit={handleSubmit} className="p-4 space-y-3">
            <label className="block text-xs font-medium text-go-dark/60 mb-1">{editId ? 'Editar anuncio' : 'Nuevo anuncio'}</label>
            <input type="text" value={message} onChange={e => setMessage(e.target.value)} placeholder="Mensaje del anuncio..." className="w-full px-4 py-2.5 rounded-xl border border-go-border bg-go-light text-sm font-dm text-go-dark focus:outline-none focus:ring-2 focus:ring-go-orange/30 focus:border-go-orange transition" />
            <div className="flex gap-2 items-center">
              <input type="file" accept="image/*" onChange={handleImageUpload} className="text-sm font-dm" />
              {uploadingImg && <span className="text-xs text-go-orange animate-pulse">Subiendo...</span>}
              {imageUrl && (
                <div className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl} alt="" className="h-10 rounded object-cover" />
                  <button type="button" onClick={() => setImageUrl('')} className="text-xs text-red-400">✕</button>
                </div>
              )}
            </div>
            <div className="flex gap-4 items-center">
              <span className="font-dm text-xs text-gray-500">Tipo:</span>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" checked={displayType === 'banner'} onChange={() => setDisplayType('banner')} className="accent-go-orange" />
                <span className="font-dm text-xs text-go-dark">Banner</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="radio" checked={displayType === 'popup'} onChange={() => setDisplayType('popup')} className="accent-go-orange" />
                <span className="font-dm text-xs text-go-dark">Pop-up</span>
              </label>
            </div>
            <button type="submit" disabled={!message.trim()} className="px-5 py-2.5 rounded-xl bg-go-orange text-white text-sm font-medium hover:bg-go-orange/90 transition disabled:opacity-50">
              {editId ? 'Guardar cambios' : 'Publicar'}
            </button>
          </form>
        </SectionCard>
      )}

      {/* All announcements table */}
      <SectionCard>
        <div className="p-4">
          <div className="overflow-x-auto rounded-xl border border-go-dark/5">
            <table className="w-full text-sm font-dm">
              <thead className="bg-go-dark/[0.03]">
                <tr>
                  {['Mensaje', 'Tipo', 'Imagen', 'Estado', 'Fecha', 'Acciones'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs text-go-dark/50 font-semibold uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-go-dark/5">
                {announcements.map(a => (
                  <tr key={a.id} className={a.is_active ? 'bg-go-orange/5' : ''}>
                    <td className="px-4 py-3 text-go-dark max-w-[200px] truncate">{a.message}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${a.display_type === 'popup' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {a.display_type === 'popup' ? 'Pop-up' : 'Banner'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {(a.image_url || a.image_file_url) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.image_url || a.image_file_url || ''} alt="" className="h-8 w-12 object-cover rounded" />
                      ) : <span className="text-xs text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => startTransition(() => toggleAnnouncement(a.id, !a.is_active))}
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full ${a.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}
                      >
                        {a.is_active ? 'Activo' : 'Inactivo'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-xs text-go-dark/40 whitespace-nowrap">
                      {new Date(a.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => startEdit(a)} className="text-xs text-go-orange hover:underline">Editar</button>
                        <button onClick={() => { if (confirm('¿Segura que quieres eliminar este anuncio?')) startTransition(async () => { await deleteAnnouncement(a.id); fb('✓ Eliminado') }) }} className="text-xs text-red-400 hover:text-red-600">Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {announcements.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-go-dark/40">No hay anuncios</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </SectionCard>
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

// ── TikTok Accounts Tab ───────────────────────────────

function TikTokAccountsTab({ accounts, startTransition }: { accounts: TikTokAccount[]; startTransition: (fn: () => void) => void }) {
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const fb = (msg: string) => { setFeedback(msg); setTimeout(() => setFeedback(null), 5000) }
  const empty = { tiktok_handle: '', tiktok_url: '', is_active: true, notes: '' }
  const [addForm, setAddForm] = useState(empty)
  const [editForm, setEditForm] = useState(empty)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-syne text-lg font-bold text-go-dark">📱 Cuentas TikTok</h2>
        <ActionButton onClick={() => setShowAdd(!showAdd)}>{showAdd ? 'Cancelar' : '+ Agregar cuenta'}</ActionButton>
      </div>

      {feedback && (
        <div className={`font-dm text-sm px-4 py-3 rounded-xl ${feedback.startsWith('Error') ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
          {feedback}
        </div>
      )}

      {showAdd && (
        <SectionCard>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormInput label="Handle (@usuario)" value={addForm.tiktok_handle} onChange={(v) => setAddForm({ ...addForm, tiktok_handle: v })} placeholder="@papayago" required />
            <FormInput label="URL de TikTok" value={addForm.tiktok_url} onChange={(v) => setAddForm({ ...addForm, tiktok_url: v })} placeholder="https://www.tiktok.com/@..." />
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Notas</label>
              <textarea value={addForm.notes} onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg border border-go-border bg-go-light text-sm font-dm text-go-dark focus:outline-none focus:ring-2 focus:ring-go-orange/30 focus:border-go-orange transition" />
            </div>
            <label className="flex items-center gap-2 font-dm text-sm">
              <input type="checkbox" checked={addForm.is_active} onChange={(e) => setAddForm({ ...addForm, is_active: e.target.checked })} className="accent-go-orange" />
              Activa
            </label>
            <div className="sm:col-span-2">
              <ActionButton onClick={() => startTransition(async () => {
                if (!addForm.tiktok_handle.trim()) { fb('Error: ingresa el handle'); return }
                const r = await addTikTokAccount({
                  tiktok_handle: addForm.tiktok_handle.trim(),
                  tiktok_url: addForm.tiktok_url.trim() || null,
                  is_active: addForm.is_active,
                  notes: addForm.notes.trim() || null,
                })
                if (r.error) fb(`Error: ${r.error}`)
                else { fb('✓ Cuenta agregada'); setAddForm(empty); setShowAdd(false) }
              })}>
                Agregar
              </ActionButton>
            </div>
          </div>
        </SectionCard>
      )}

      <SectionCard>
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-dm">
            <thead className="bg-go-light/50">
              <tr>
                {['Handle', 'URL', 'Notas', 'Activa', 'Creada', 'Acciones'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-go-dark/60">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-go-border">
              {accounts.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-go-dark/40">No hay cuentas todavía.</td></tr>
              )}
              {accounts.map(a => (
                <tr key={a.id} className="hover:bg-go-light/30">
                  {editId === a.id ? (
                    <>
                      <td className="px-4 py-3"><input value={editForm.tiktok_handle} onChange={(e) => setEditForm({ ...editForm, tiktok_handle: e.target.value })} className="w-full px-2 py-1 text-xs rounded border border-go-border" /></td>
                      <td className="px-4 py-3"><input value={editForm.tiktok_url} onChange={(e) => setEditForm({ ...editForm, tiktok_url: e.target.value })} className="w-full px-2 py-1 text-xs rounded border border-go-border" /></td>
                      <td className="px-4 py-3"><input value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} className="w-full px-2 py-1 text-xs rounded border border-go-border" /></td>
                      <td className="px-4 py-3"><input type="checkbox" checked={editForm.is_active} onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })} className="accent-go-orange" /></td>
                      <td className="px-4 py-3 text-xs text-go-dark/40">{new Date(a.created_at).toLocaleDateString('es')}</td>
                      <td className="px-4 py-3 space-x-1">
                        <ActionButton onClick={() => startTransition(async () => {
                          const r = await updateTikTokAccount(a.id, {
                            tiktok_handle: editForm.tiktok_handle.trim(),
                            tiktok_url: editForm.tiktok_url.trim() || null,
                            is_active: editForm.is_active,
                            notes: editForm.notes.trim() || null,
                          })
                          if (r.error) fb(`Error: ${r.error}`)
                          else { fb('✓ Actualizada'); setEditId(null) }
                        })}>Guardar</ActionButton>
                        <ActionButton variant="ghost" onClick={() => setEditId(null)}>Cancelar</ActionButton>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 font-medium text-go-orange">{a.tiktok_handle}</td>
                      <td className="px-4 py-3 text-xs">
                        {a.tiktok_url ? (
                          <a href={a.tiktok_url} target="_blank" rel="noopener noreferrer" className="text-go-orange hover:underline truncate block max-w-[200px]">{a.tiktok_url}</a>
                        ) : <span className="text-go-dark/30">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-go-dark/60 max-w-[200px] truncate">{a.notes ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${a.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                          {a.is_active ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-go-dark/40">{new Date(a.created_at).toLocaleDateString('es')}</td>
                      <td className="px-4 py-3 space-x-1">
                        <ActionButton variant="ghost" onClick={() => {
                          setEditId(a.id)
                          setEditForm({
                            tiktok_handle: a.tiktok_handle,
                            tiktok_url: a.tiktok_url ?? '',
                            is_active: a.is_active,
                            notes: a.notes ?? '',
                          })
                        }}>Editar</ActionButton>
                        <ActionButton variant="ghost" onClick={() => {
                          if (confirm(`¿Eliminar @${a.tiktok_handle}?`)) {
                            startTransition(async () => {
                              const r = await deleteTikTokAccount(a.id)
                              if (r.error) fb(`Error: ${r.error}`)
                              else fb('✓ Eliminada')
                            })
                          }
                        }}>Eliminar</ActionButton>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  )
}

// ── Internal Videos Tab ───────────────────────────────

function InternalVideosTab({ videos, creators, startTransition }: { videos: InternalVideo[]; creators: Creator[]; startTransition: (fn: () => void) => void }) {
  const [feedback, setFeedback] = useState<string | null>(null)
  const fb = (msg: string) => { setFeedback(msg); setTimeout(() => setFeedback(null), 5000) }
  const [creatorFilter, setCreatorFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'ACC' | 'TTD'>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const filtered = videos.filter(v => {
    if (creatorFilter !== 'all' && v.creator_id !== creatorFilter) return false
    if (statusFilter !== 'all' && v.status !== statusFilter) return false
    if (typeFilter !== 'all' && v.video_type !== typeFilter) return false
    if (dateFrom && v.submitted_at < dateFrom) return false
    if (dateTo && v.submitted_at > dateTo + 'T23:59:59') return false
    return true
  })

  function toggleSelected(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Stats — anchored on submitted_at (when the creator posted) per spec.
  // Using approved_at would skew "Aprobados hoy" toward the moment the
  // admin clicked Aprobar, not when the video actually went up.
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
  const weekStart = new Date(todayStart); const dow = todayStart.getDay(); weekStart.setDate(todayStart.getDate() + (dow === 0 ? -6 : 1 - dow))
  const totalPending = videos.filter(v => v.status === 'pending').length
  const totalApprovedToday = videos.filter(v => v.status === 'approved' && new Date(v.submitted_at) >= todayStart).length
  const totalApprovedWeek = videos.filter(v => v.status === 'approved' && new Date(v.submitted_at) >= weekStart).length

  return (
    <div className="space-y-4">
      <h2 className="font-syne text-lg font-bold text-go-dark">🎬 Videos Internos</h2>

      {feedback && (
        <div className={`font-dm text-sm px-4 py-3 rounded-xl ${feedback.startsWith('Error') ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
          {feedback}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="font-dm text-xs uppercase tracking-wide text-amber-700/70">Total pendientes</p>
          <p className="font-syne font-bold text-3xl text-amber-700 mt-1">{totalPending}</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <p className="font-dm text-xs uppercase tracking-wide text-emerald-700/70">Aprobados hoy</p>
          <p className="font-syne font-bold text-3xl text-emerald-700 mt-1">{totalApprovedToday}</p>
        </div>
        <div className="bg-go-orange/10 border border-go-orange/20 rounded-xl p-4">
          <p className="font-dm text-xs uppercase tracking-wide text-go-orange">Aprobados esta semana</p>
          <p className="font-syne font-bold text-3xl text-go-orange mt-1">{totalApprovedWeek}</p>
        </div>
      </div>

      {/* Filters */}
      <SectionCard>
        <div className="p-4 grid grid-cols-2 sm:grid-cols-5 gap-3">
          <select value={creatorFilter} onChange={(e) => setCreatorFilter(e.target.value)} className="px-3 py-2 rounded-lg border border-go-border bg-go-light text-sm font-dm text-go-dark">
            <option value="all">Todas las creadoras</option>
            {creators.filter(c => c.is_internal).map(c => (
              <option key={c.id} value={c.id}>{c.full_name ?? c.email}</option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | 'pending' | 'approved' | 'rejected')} className="px-3 py-2 rounded-lg border border-go-border bg-go-light text-sm font-dm text-go-dark">
            <option value="all">Todos los estados</option>
            <option value="pending">⏳ Pendiente</option>
            <option value="approved">✅ Aprobado</option>
            <option value="rejected">❌ Rechazado</option>
          </select>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as 'all' | 'ACC' | 'TTD')} className="px-3 py-2 rounded-lg border border-go-border bg-go-light text-sm font-dm text-go-dark">
            <option value="all">ACC + TTD</option>
            <option value="ACC">ACC</option>
            <option value="TTD">TTD</option>
          </select>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="px-3 py-2 rounded-lg border border-go-border bg-go-light text-sm font-dm text-go-dark" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="px-3 py-2 rounded-lg border border-go-border bg-go-light text-sm font-dm text-go-dark" />
        </div>
      </SectionCard>

      {/* Bulk action */}
      {selectedIds.size > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <p className="font-dm text-sm text-emerald-700">{selectedIds.size} seleccionado(s)</p>
          <div className="flex gap-2">
            <button
              onClick={() => startTransition(async () => {
                const r = await bulkApproveInternalVideos(Array.from(selectedIds))
                if (r.error) fb(`Error: ${r.error}`)
                else { fb(`✓ ${r.count} aprobados`); setSelectedIds(new Set()) }
              })}
              className="font-dm text-sm font-semibold bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition"
            >
              ✅ Aprobar seleccionados
            </button>
            <button onClick={() => setSelectedIds(new Set())} className="font-dm text-sm text-emerald-700/60 px-3">Cancelar</button>
          </div>
        </div>
      )}

      <SectionCard>
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-dm">
            <thead className="bg-go-light/50">
              <tr>
                <th className="px-3 py-3 w-10"></th>
                {['Creator', 'Cuenta', 'URL Video', 'Tipo', 'Enviado', 'Estado', 'Acciones'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-go-dark/60">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-go-border">
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-go-dark/40">No hay videos para los filtros seleccionados.</td></tr>
              )}
              {filtered.map(v => (
                <tr key={v.id} className={v.status === 'approved' ? 'bg-emerald-50/40' : v.status === 'rejected' ? 'bg-red-50/40' : ''}>
                  <td className="px-3 py-3">
                    {v.status === 'pending' && (
                      <input type="checkbox" checked={selectedIds.has(v.id)} onChange={() => toggleSelected(v.id)} className="accent-go-orange" />
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-go-dark">{v.creator?.full_name ?? v.creator?.email ?? '—'}</td>
                  <td className="px-4 py-3 text-go-orange text-xs">{v.tiktok_account?.tiktok_handle ?? '—'}</td>
                  <td className="px-4 py-3 text-xs">
                    <a href={v.tiktok_url} target="_blank" rel="noopener noreferrer" className="text-go-orange hover:underline truncate block max-w-[200px]">{v.tiktok_url}</a>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${v.video_type === 'ACC' ? 'bg-orange-100 text-orange-700' : 'bg-pink-100 text-pink-700'}`}>{v.video_type}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-go-dark/50">{new Date(v.submitted_at).toLocaleDateString('es')}</td>
                  <td className="px-4 py-3">
                    {v.status === 'pending' && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">⏳ Pendiente</span>}
                    {v.status === 'approved' && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">✅ Aprobado</span>}
                    {v.status === 'rejected' && (
                      <div>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">❌ Rechazado</span>
                        {v.rejection_reason && <p className="text-[10px] text-red-500 mt-1 max-w-[180px]">{v.rejection_reason}</p>}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 space-x-1">
                    {v.status === 'pending' ? (
                      <>
                        <button
                          onClick={() => startTransition(async () => {
                            const r = await approveInternalVideo(v.id)
                            if (r.error) fb(`Error: ${r.error}`)
                            else fb('✓ Aprobado')
                          })}
                          className="font-dm text-xs font-semibold bg-emerald-600 text-white px-3 py-1 rounded-lg hover:bg-emerald-700 transition"
                        >
                          ✅ Aprobar
                        </button>
                        <button
                          onClick={() => { setRejectingId(v.id); setRejectReason('') }}
                          className="font-dm text-xs font-semibold bg-red-100 text-red-700 px-3 py-1 rounded-lg hover:bg-red-200 transition"
                        >
                          ❌ Rechazar
                        </button>
                      </>
                    ) : (
                      <span className="text-xs text-go-dark/40">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Reject modal */}
      {rejectingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-go-dark/40 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h3 className="font-syne font-bold text-lg text-go-dark mb-3">Rechazar video</h3>
            <p className="font-dm text-xs text-go-dark/60 mb-3">Escribe la razón del rechazo. La creadora la verá en su dashboard.</p>
            <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} placeholder="Ej. URL inválida, video no relacionado con la marca..." className="w-full px-3 py-2 rounded-lg border border-go-border bg-go-light text-sm font-dm text-go-dark focus:outline-none focus:ring-2 focus:ring-go-orange/30 focus:border-go-orange transition" />
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setRejectingId(null)} className="font-dm text-sm text-go-dark/60 px-4 py-2">Cancelar</button>
              <button
                disabled={!rejectReason.trim()}
                onClick={() => startTransition(async () => {
                  const r = await rejectInternalVideo(rejectingId!, rejectReason.trim())
                  if (r.error) fb(`Error: ${r.error}`)
                  else { fb('✓ Rechazado'); setRejectingId(null); setRejectReason('') }
                })}
                className="font-dm text-sm font-semibold bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition disabled:opacity-50"
              >
                Rechazar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Admin Dashboard Tab ───────────────────────────────

const MONTH_NAMES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const RING_CIRC = 2 * Math.PI * 60 // r=60

function DashboardRing({
  current, goal, remaining, label, color,
}: { current: number; goal: number; remaining: number; label: string; color: string }) {
  const safeGoal = Math.max(goal, 1)
  const pct = Math.min(current / safeGoal, 1)
  const offset = RING_CIRC - pct * RING_CIRC
  const complete = goal > 0 && current >= goal
  const ringColor = complete ? '#2a9d4a' : color
  const fmt = (n: number) => n.toLocaleString('en-US')
  // Two lines under the ring:
  //   1. Progress (always bold, neutral). "X aprobados de Y".
  //   2. Remaining-to-goal — orange while we're short, green once met.
  // The "esperando revisión" hint moved out to the QuickStat card so the
  // ring stays focused on goal progress.
  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative" style={{ width: 150, height: 150 }}>
        <svg width="150" height="150" viewBox="0 0 150 150" className="block">
          <circle cx="75" cy="75" r="60" fill="none" stroke="rgba(26,8,0,0.08)" strokeWidth="12" />
          <circle
            cx="75" cy="75" r="60" fill="none"
            stroke={ringColor} strokeWidth="12" strokeLinecap="round"
            strokeDasharray={RING_CIRC}
            strokeDashoffset={offset}
            transform="rotate(-90 75 75)"
            style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.22, 1, 0.36, 1), stroke 0.3s' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-syne font-bold text-3xl text-go-dark leading-none">{current}</span>
          <span className="font-dm text-xs text-go-dark/40 mt-1">de {fmt(goal)}</span>
        </div>
      </div>
      <p className="mt-3 font-syne font-bold text-base text-go-dark">{label}</p>
      <p className="mt-1 font-dm text-sm font-bold text-go-dark">
        {fmt(current)} aprobados de {fmt(goal)}
      </p>
      <p className={`mt-0.5 font-dm text-sm font-semibold ${complete ? 'text-emerald-700' : 'text-[#ff7700]'}`}>
        {complete ? '✅ Meta cumplida' : `Faltan ${fmt(remaining)} para la meta`}
      </p>
    </div>
  )
}

function QuickStat({ label, value, accent = 'dark' }: { label: string; value: number; accent?: 'dark' | 'orange' | 'green' | 'pink' }) {
  const colors = {
    dark: 'text-go-dark',
    orange: 'text-[#ff7700]',
    green: 'text-emerald-600',
    pink: 'text-pink-600',
  }
  return (
    <div className="bg-white border border-go-dark/[0.06] rounded-2xl p-5">
      <p className={`font-syne font-bold text-3xl leading-none ${colors[accent]}`}>{value}</p>
      <p className="font-dm text-xs text-go-dark/50 mt-2">{label}</p>
    </div>
  )
}

function MonthlyGoalEditor({
  month, year, accGoal, ttdGoal, lastUpdated, startTransition,
}: {
  month: number
  year: number
  accGoal: number
  ttdGoal: number
  lastUpdated: string | null
  startTransition: (cb: () => void) => void
}) {
  const [accInput, setAccInput] = useState(String(accGoal))
  const [ttdInput, setTtdInput] = useState(String(ttdGoal))
  const [feedback, setFeedback] = useState<string | null>(null)

  function fb(msg: string) { setFeedback(msg); setTimeout(() => setFeedback(null), 4000) }

  return (
    <SectionCard>
      <div className="p-6">
        <h3 className="font-syne font-bold text-base text-go-dark mb-1">
          Meta de {MONTH_NAMES_ES[month - 1]} {year}
        </h3>
        <p className="font-dm text-xs text-go-dark/50 mb-4">
          Estos números son la meta de equipo para todo el mes (regulares + interno).
        </p>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block font-dm text-xs font-semibold text-go-dark/60 mb-1">ACC videos</label>
            <input
              type="number" min="0"
              value={accInput}
              onChange={(e) => setAccInput(e.target.value)}
              className="w-32 px-3 py-2 rounded-lg border border-go-border bg-go-light text-sm font-dm text-go-dark focus:outline-none focus:ring-2 focus:ring-go-orange/30 focus:border-go-orange transition"
            />
          </div>
          <div>
            <label className="block font-dm text-xs font-semibold text-go-dark/60 mb-1">TTD videos</label>
            <input
              type="number" min="0"
              value={ttdInput}
              onChange={(e) => setTtdInput(e.target.value)}
              className="w-32 px-3 py-2 rounded-lg border border-go-border bg-go-light text-sm font-dm text-go-dark focus:outline-none focus:ring-2 focus:ring-go-orange/30 focus:border-go-orange transition"
            />
          </div>
          <button
            onClick={() => startTransition(async () => {
              const acc = parseInt(accInput, 10)
              const ttd = parseInt(ttdInput, 10)
              if (Number.isNaN(acc) || Number.isNaN(ttd)) { fb('Error: Números inválidos'); return }
              const r = await upsertMonthlyGoal({ month, year, acc_goal: acc, ttd_goal: ttd })
              if (r.error) fb(`Error: ${r.error}`)
              else fb('✓ Meta actualizada')
            })}
            className="bg-go-orange text-white text-sm font-syne font-bold px-5 py-2 rounded-lg hover:bg-go-orange/90 transition"
          >
            Guardar meta
          </button>
        </div>
        {feedback && (
          <p className={`text-xs font-dm mt-3 ${feedback.startsWith('Error') ? 'text-red-600' : 'text-emerald-700'}`}>
            {feedback}
          </p>
        )}
        {lastUpdated && (
          <p className="font-dm text-[11px] text-go-dark/40 mt-3">
            Última actualización: {new Date(lastUpdated).toLocaleString('es')}
          </p>
        )}
      </div>
    </SectionCard>
  )
}

function VideoTrackerSection({
  regular, boostRequests, startTransition,
}: {
  regular: Creator[]
  boostRequests: BoostRequest[]
  startTransition: (cb: () => void) => void
}) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'ACC' | 'TTD' | 'pending'>('all')
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [editing, setEditing] = useState<{ id: string; url: string; type: 'ACC' | 'TTD' } | null>(null)
  const [preview, setPreview] = useState<{ url: string; boostId: string } | null>(null)
  const [rejectModal, setRejectModal] = useState<{ open: boolean; boostId: string | null; url: string | null; reason: string }>({ open: false, boostId: null, url: null, reason: '' })
  const [feedback, setFeedback] = useState<string | null>(null)
  const router = useRouter()
  function fb(msg: string) { setFeedback(msg); setTimeout(() => setFeedback(null), 4000) }
  function closeRejectModal() { setRejectModal({ open: false, boostId: null, url: null, reason: '' }) }

  const requestsByCreator = new Map<string, BoostRequest[]>()
  for (const r of boostRequests) {
    if (!r.creator_id) continue
    const arr = requestsByCreator.get(r.creator_id) ?? []
    arr.push(r)
    requestsByCreator.set(r.creator_id, arr)
  }

  // ACC / TTD per-creator totals reflect VALID videos this month;
  // pending-review count is shown alongside but doesn't add to the total.
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const isThisMonth = (iso: string) => iso >= monthStart

  const rows = regular.map(c => {
    const all = requestsByCreator.get(c.id) ?? []
    const thisMonth = all.filter(b => isThisMonth(b.created_at))
    const validThisMonth = thisMonth.filter(b => b.is_valid === true)
    const acc = validThisMonth.filter(b => b.video_type === 'ACC').length
    const ttd = validThisMonth.filter(b => b.video_type === 'TTD').length
    const pending = thisMonth.filter(b => b.is_valid == null).length
    const lastUpload = all.reduce<string | null>((latest, b) => {
      if (!latest || b.created_at > latest) return b.created_at
      return latest
    }, null)
    return { creator: c, requests: all, acc, ttd, total: acc + ttd, pending, lastUpload }
  }).sort((a, b) => b.total - a.total)

  function filterRequests(reqs: BoostRequest[]) {
    if (filter === 'all') return reqs
    if (filter === 'pending') return reqs.filter(r => r.is_valid == null)
    return reqs.filter(r => r.video_type === filter)
  }

  return (
    <SectionCard>
      <div className="p-6">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h3 className="font-syne font-bold text-base text-go-dark">🎬 Videos por Creadora</h3>
          <div className="flex gap-1.5">
            {([['all', 'Todos'], ['ACC', 'ACC'], ['TTD', 'TTD'], ['pending', 'Pendientes']] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full font-dm transition ${
                  filter === key ? 'bg-go-orange text-white' : 'bg-go-dark/[0.04] text-go-dark/60 hover:bg-go-dark/[0.08]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {feedback && (
          <p className={`text-sm font-dm mb-3 px-3 py-2 rounded-lg ${feedback.startsWith('Error') ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>
            {feedback}
          </p>
        )}

        <div className="overflow-x-auto rounded-2xl border border-go-dark/5">
          <table className="w-full text-sm font-dm">
            <thead className="bg-go-dark/[0.03]">
              <tr>
                {['Creadora', '@handle', 'Nivel', 'ACC', 'TTD', 'Total', 'Pendientes', 'Última subida', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs text-go-dark/50 font-semibold uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-go-dark/5">
              {rows.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-go-dark/40">No hay creadoras regulares activas.</td></tr>
              )}
              {rows.map(row => {
                const isOpen = expanded === row.creator.id
                const visibleRequests = filterRequests(row.requests)
                return (
                  <>
                    <tr
                      key={row.creator.id}
                      onClick={() => { setExpanded(isOpen ? null : row.creator.id); setRejectingId(null); setRejectReason('') }}
                      className="cursor-pointer hover:bg-go-light/40 transition"
                    >
                      <td className="px-4 py-3 font-medium text-go-dark">{row.creator.full_name ?? row.creator.email}</td>
                      <td className="px-4 py-3 text-go-dark/60 text-xs">{row.creator.tiktok_handle ?? '—'}</td>
                      <td className="px-4 py-3"><span className="text-xs font-bold px-2 py-0.5 rounded-full bg-go-dark/[0.06] text-go-dark/70">N{row.creator.nivel}</span></td>
                      <td className="px-4 py-3"><span className="text-xs font-bold text-orange-700">{row.acc}</span></td>
                      <td className="px-4 py-3"><span className="text-xs font-bold text-pink-700">{row.ttd}</span></td>
                      <td className="px-4 py-3 font-syne font-bold text-go-dark">{row.total}</td>
                      <td className="px-4 py-3">{row.pending > 0 ? <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">{row.pending}</span> : <span className="text-xs text-go-dark/30">—</span>}</td>
                      <td className="px-4 py-3 text-xs text-go-dark/40">{row.lastUpload ? new Date(row.lastUpload).toLocaleDateString('es') : '—'}</td>
                      <td className="px-4 py-3 text-go-dark/40">{isOpen ? '▾' : '▸'}</td>
                    </tr>
                    {isOpen && (
                      <tr key={`${row.creator.id}-detail`} className="bg-go-light/30">
                        <td colSpan={9} className="px-4 py-4">
                          {visibleRequests.length === 0 ? (
                            <p className="font-dm text-xs text-go-dark/40 text-center py-4">Sin videos para este filtro.</p>
                          ) : (
                            <div className="space-y-2">
                              {visibleRequests.map(req => (
                                <div key={req.id} className="bg-white rounded-xl border border-go-dark/5 p-3 space-y-2">
                                  <div className="flex items-center gap-3 flex-wrap">
                                    <span className="text-xs text-go-dark/50 w-24 shrink-0">{new Date(req.created_at).toLocaleDateString('es')}</span>
                                    {req.video_type && (
                                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${req.video_type === 'ACC' ? 'bg-orange-100 text-orange-700' : 'bg-pink-100 text-pink-700'}`}>{req.video_type}</span>
                                    )}
                                    <a
                                      href={req.tiktok_url || req.video_url || '#'}
                                      target="_blank" rel="noopener noreferrer"
                                      className="text-xs text-go-orange hover:underline truncate flex-1 min-w-0"
                                    >
                                      {req.tiktok_url || req.video_url || '(sin URL)'}
                                    </a>
                                    <PreviewButton url={req.tiktok_url || req.video_url} onOpen={() => {
                                      const u = req.tiktok_url || req.video_url
                                      if (u) setPreview({ url: u, boostId: req.id })
                                    }} />
                                    <ShortLinkBadge url={req.tiktok_url || req.video_url} />
                                    <EditableLinkRow boostId={req.id} url={req.tiktok_url || req.video_url} onSaved={fb} />
                                  </div>
                                  <div className="flex flex-wrap items-center gap-3">
                                    <ValidityCell
                                      isValid={req.is_valid}
                                      onMarkValid={() => startTransition(async () => {
                                        const r = await setBoostValidity(req.id, true)
                                        if (r.error) fb(`Error: ${r.error}`); else fb('✓ Marcado válido')
                                      })}
                                      onMarkInvalid={() => {
                                        console.log(`Inválido button clicked for boost ID: ${req.id}`)
                                        setRejectModal({ open: true, boostId: req.id, url: req.tiktok_url || req.video_url || null, reason: '' })
                                      }}
                                    />
                                    {rejectingId === req.id ? (
                                      <div className="flex gap-1 items-center">
                                        <input
                                          autoFocus
                                          value={rejectReason}
                                          onClick={(e) => e.stopPropagation()}
                                          onChange={(e) => setRejectReason(e.target.value)}
                                          placeholder="Razón..."
                                          className="text-[11px] px-2 py-0.5 rounded-md border border-red-200 bg-white"
                                        />
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            startTransition(async () => {
                                              const r = await setBoostStatus(req.id, 'rechazado', rejectReason)
                                              if (r.error) fb(`Error: ${r.error}`)
                                              else { fb('✓ Sin boost'); setRejectingId(null); setRejectReason('') }
                                            })
                                          }}
                                          className="text-[10px] font-semibold bg-red-500 text-white px-2 py-0.5 rounded-md hover:bg-red-600"
                                        >Confirmar</button>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); setRejectingId(null); setRejectReason('') }}
                                          className="text-[10px] font-semibold bg-go-dark/[0.06] text-go-dark/60 px-2 py-0.5 rounded-md"
                                        >Cancelar</button>
                                      </div>
                                    ) : (
                                      <BoostDecisionCell
                                        boostStatus={req.boost_status}
                                        boostRequested={!!req.boost_requested}
                                        onApprove={() => startTransition(async () => {
                                          const r = await setBoostStatus(req.id, 'boosteado')
                                          if (r.error) fb(`Error: ${r.error}`); else fb('✓ Boost aprobado')
                                        })}
                                        onReject={() => { setRejectingId(req.id); setRejectReason('') }}
                                      />
                                    )}
                                  </div>
                                  {req.boost_status === 'rechazado' && req.rejection_reason && (
                                    <p className="text-xs text-red-600/80 mt-1">Razón: {req.rejection_reason}</p>
                                  )}
                                  <div className="flex justify-end">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setEditing({ id: req.id, url: req.tiktok_url ?? '', type: (req.video_type ?? 'ACC') as 'ACC' | 'TTD' }) }}
                                      className="text-[10px] font-semibold text-go-dark/60 bg-go-dark/[0.05] hover:bg-go-dark/[0.1] px-2 py-0.5 rounded-md"
                                    >✏️ Editar</button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* TikTok preview modal */}
      <TikTokPreviewModal
        url={preview?.url ?? null}
        onClose={() => setPreview(null)}
      />

      {/* Invalid-reason modal */}
      {rejectModal.open && (
        <InvalidReasonModal
          tiktokUrl={rejectModal.url}
          reason={rejectModal.reason}
          onReasonChange={(next) => setRejectModal((m) => ({ ...m, reason: next }))}
          onClose={closeRejectModal}
          onConfirm={() => {
            const { boostId, reason } = rejectModal
            if (!boostId) return
            startTransition(async () => {
              const r = await setBoostInvalid(boostId, reason.trim())
              if (r.error) { fb(`Error: ${r.error}`); return }
              fb('❌ Video marcado como inválido')
              closeRejectModal()
              router.refresh()
            })
          }}
        />
      )}

      {/* Edit modal — same pattern as BoostsTab */}
      {editing && (
        <div className="fixed inset-0 z-[180] bg-black/60 flex items-center justify-center px-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-syne font-bold text-lg text-go-dark mb-4">Editar video</h3>
            <label className="block font-dm text-xs font-semibold text-go-dark/60 uppercase tracking-wide mb-1">TikTok URL</label>
            <input
              type="url"
              value={editing.url}
              onChange={(e) => setEditing({ ...editing, url: e.target.value })}
              className="w-full border border-go-border rounded-lg px-3 py-2 font-dm text-sm focus:outline-none focus:ring-2 focus:ring-go-orange/30 focus:border-go-orange"
            />
            <label className="block font-dm text-xs font-semibold text-go-dark/60 uppercase tracking-wide mt-4 mb-1">Tipo de video</label>
            <div className="flex gap-2">
              {(['ACC', 'TTD'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setEditing({ ...editing, type: t })}
                  className={`flex-1 py-2 rounded-lg font-dm font-semibold text-sm border-2 transition ${editing.type === t ? 'bg-go-orange text-white border-go-orange' : 'bg-white text-go-dark/60 border-go-border'}`}
                >{t}</button>
              ))}
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => startTransition(async () => {
                  if (!editing) return
                  const r = await updateBoostRequest(editing.id, { tiktok_url: editing.url, video_type: editing.type })
                  if (r.error) fb(`Error: ${r.error}`)
                  else { fb('✅ Video actualizado correctamente'); setEditing(null) }
                })}
                className="flex-1 bg-go-orange text-white font-dm font-semibold text-sm py-2.5 rounded-lg hover:bg-go-orange/90"
              >Guardar cambios</button>
              <button
                onClick={() => setEditing(null)}
                className="flex-1 bg-go-dark/[0.06] text-go-dark/70 font-dm font-semibold text-sm py-2.5 rounded-lg hover:bg-go-dark/[0.1]"
              >Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  )
}

// ── Crecimiento Tab ───────────────────────────────────

import { MonthlyAccTtdBars, GmvLine, CreatorsLine, type SnapshotPoint } from './CrecimientoCharts'

function CrecimientoTab({
  monthlySnapshots, creators, internalVideos, boostRequests, monthlyGoal, currentMonth, currentYear, startTransition,
}: {
  monthlySnapshots: MonthlySnapshot[]
  creators: Creator[]
  internalVideos: InternalVideo[]
  boostRequests: BoostRequest[]
  monthlyGoal: MonthlyGoal | null
  currentMonth: number
  currentYear: number
  startTransition: (cb: () => void) => void
}) {
  const [feedback, setFeedback] = useState<string | null>(null)
  const [selectedKey, setSelectedKey] = useState<string>(`${currentYear}-${String(currentMonth).padStart(2, '0')}`)
  function fb(msg: string) { setFeedback(msg); setTimeout(() => setFeedback(null), 4000) }

  const accGoal = monthlyGoal?.acc_goal ?? 300
  const ttdGoal = monthlyGoal?.ttd_goal ?? 300

  // Live current-month aggregates — only VALID videos count toward
  // the totals; pending-review and boost_status are tracked separately.
  const startOfMonth = new Date(Date.UTC(currentYear, currentMonth - 1, 1)).toISOString()
  const active = creators.filter(c => c.status === 'active')
  const regular = active.filter(c => !c.is_internal)
  const internal = active.filter(c => c.is_internal)
  const regularIds = new Set(regular.map(c => c.id))
  const regularBoostsThisMonth = boostRequests.filter(b => b.creator_id && regularIds.has(b.creator_id) && b.created_at >= startOfMonth)
  const regularValid = regularBoostsThisMonth.filter(b => b.is_valid === true)
  const regAcc = regularValid.filter(b => b.video_type === 'ACC').length
  const regTtd = regularValid.filter(b => b.video_type === 'TTD').length
  const regSubmitted = regularBoostsThisMonth.length
  const regValid = regularValid.length
  const regPendingReview = regularBoostsThisMonth.filter(b => b.is_valid == null).length
  const regBoosted = regularBoostsThisMonth.filter(b => b.boost_status === 'boosteado').length
  // Internal videos: anchor "this month" on submitted_at so an approval
  // that lands in the next calendar month doesn't pull the row forward.
  const internalApprovedThisMonth = internalVideos.filter(v => v.status === 'approved' && v.submitted_at >= startOfMonth)
  const intAcc = internalApprovedThisMonth.filter(v => v.video_type === 'ACC').length
  const intTtd = internalApprovedThisMonth.filter(v => v.video_type === 'TTD').length
  const intPending = internalVideos.filter(v => v.status === 'pending').length
  const totalAcc = regAcc + intAcc
  const totalTtd = regTtd + intTtd
  const totalGmv = active.reduce((s, c) => s + Number(c.gmv_this_month ?? 0), 0)
  const newCreatorsThisMonth = creators.filter(c => c.approved_at && c.approved_at >= startOfMonth).length

  // Look up the previous month's snapshot for MoM cards
  const prevDate = new Date(Date.UTC(currentYear, currentMonth - 2, 1))
  const prevMonth = prevDate.getUTCMonth() + 1
  const prevYear = prevDate.getUTCFullYear()
  const prev = monthlySnapshots.find(s => s.month === prevMonth && s.year === prevYear)

  const mom = (current: number, last: number | undefined): { delta: number; pct: number | null } => {
    if (last == null) return { delta: current, pct: null }
    const delta = current - last
    if (last === 0) return { delta, pct: current > 0 ? 100 : 0 }
    return { delta, pct: Math.round((delta / last) * 100) }
  }
  const accMom = mom(totalAcc, prev?.total_acc_videos)
  const ttdMom = mom(totalTtd, prev?.total_ttd_videos)
  const gmvMom = mom(totalGmv, prev ? Number(prev.total_gmv) : undefined)
  const newMom = mom(newCreatorsThisMonth, prev?.new_creators)

  // Build the last-6-months chart series (ascending), preferring snapshot data
  // and using live current-month aggregates only for the current cell.
  const series: SnapshotPoint[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(currentYear, currentMonth - 1 - i, 1))
    const m = d.getUTCMonth() + 1
    const y = d.getUTCFullYear()
    if (m === currentMonth && y === currentYear) {
      series.push({ month: m, year: y, acc: totalAcc, ttd: totalTtd, gmv: totalGmv, creators: active.length })
    } else {
      const snap = monthlySnapshots.find(s => s.month === m && s.year === y)
      series.push({
        month: m, year: y,
        acc: snap?.total_acc_videos ?? 0,
        ttd: snap?.total_ttd_videos ?? 0,
        gmv: snap ? Number(snap.total_gmv) : 0,
        creators: snap?.total_creators ?? 0,
      })
    }
  }

  // Top contributors (valid-only this month)
  const accByCreator = new Map<string, number>()
  const ttdByCreator = new Map<string, number>()
  for (const b of regularValid) {
    if (!b.creator_id) continue
    if (b.video_type === 'ACC') accByCreator.set(b.creator_id, (accByCreator.get(b.creator_id) ?? 0) + 1)
    if (b.video_type === 'TTD') ttdByCreator.set(b.creator_id, (ttdByCreator.get(b.creator_id) ?? 0) + 1)
  }
  const topAcc = [...regular].map(c => ({ ...c, _v: accByCreator.get(c.id) ?? 0 })).filter(c => c._v > 0).sort((a, b) => b._v - a._v).slice(0, 5)
  const topTtd = [...regular].map(c => ({ ...c, _v: ttdByCreator.get(c.id) ?? 0 })).filter(c => c._v > 0).sort((a, b) => b._v - a._v).slice(0, 5)
  const intByCreator = new Map<string, { acc: number; ttd: number }>()
  for (const v of internalApprovedThisMonth) {
    if (!v.creator_id) continue
    const cur = intByCreator.get(v.creator_id) ?? { acc: 0, ttd: 0 }
    if (v.video_type === 'ACC') cur.acc++
    else if (v.video_type === 'TTD') cur.ttd++
    intByCreator.set(v.creator_id, cur)
  }
  // Match any creator that has go_internal_videos rows, not just those
  // currently flagged is_internal. Otherwise a row authored when the
  // flag was on disappears from Top Equipo Interno after the flag flips,
  // which makes the list look empty even when videos exist.
  const creatorsById = new Map(creators.map(c => [c.id, c]))
  const topInt = Array.from(intByCreator.entries())
    .map(([id, c]) => ({ creator: creatorsById.get(id), acc: c.acc, ttd: c.ttd, total: c.acc + c.ttd }))
    .filter(x => x.creator)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  // Snapshot the user has selected from the dropdown (header)
  const sortedSnapshots = [...monthlySnapshots].sort((a, b) => (b.year * 100 + b.month) - (a.year * 100 + a.month))
  const lastSnapshotAt = sortedSnapshots[0]?.snapshot_taken_at ?? null

  function exportCsv() {
    const header = ['Mes', 'Año', 'ACC', 'TTD', 'GMV', 'Creadoras', 'Nuevas', 'Int. ACC', 'Int. TTD', 'Guardado']
    const rows = sortedSnapshots.map(s => [
      MONTH_NAMES_ES[s.month - 1], s.year, s.total_acc_videos, s.total_ttd_videos,
      Number(s.total_gmv).toFixed(2), s.total_creators, s.new_creators,
      s.internal_acc_videos, s.internal_ttd_videos,
      new Date(s.snapshot_taken_at).toISOString().split('T')[0],
    ])
    const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replaceAll('"', '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `papaya-go-snapshots-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function MomCard({ label, current, mom: m, formatter }: { label: string; current: number; mom: { delta: number; pct: number | null }; formatter: (n: number) => string }) {
    const up = m.delta > 0
    const flat = m.delta === 0
    const color = flat ? 'text-gray-500' : up ? 'text-emerald-600' : 'text-red-600'
    const arrow = flat ? '=' : up ? '▲' : '▼'
    return (
      <div className="bg-white border border-go-dark/[0.06] rounded-2xl p-5">
        <p className="font-dm text-xs text-go-dark/50 uppercase tracking-wide">{label}</p>
        <p className="font-syne font-bold text-3xl text-go-dark mt-1">{formatter(current)}</p>
        <p className={`font-dm text-xs font-semibold mt-2 ${color}`}>
          {arrow} {formatter(Math.abs(m.delta))} {m.pct != null && `(${m.pct >= 0 ? '+' : ''}${m.pct}%)`} vs mes pasado
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-syne text-2xl font-bold text-go-dark">📈 Panel de Crecimiento</h2>
          {lastSnapshotAt && (
            <p className="font-dm text-xs text-go-dark/50 mt-1">Último snapshot: {new Date(lastSnapshotAt).toLocaleString('es')}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedKey}
            onChange={(e) => setSelectedKey(e.target.value)}
            className="text-xs px-3 py-1.5 rounded-lg border border-go-border bg-go-light font-dm text-go-dark"
          >
            <option value={`${currentYear}-${String(currentMonth).padStart(2, '0')}`}>
              {MONTH_NAMES_ES[currentMonth - 1]} {currentYear} (en curso)
            </option>
            {sortedSnapshots.map(s => (
              <option key={`${s.year}-${s.month}`} value={`${s.year}-${String(s.month).padStart(2, '0')}`}>
                {MONTH_NAMES_ES[s.month - 1]} {s.year}
              </option>
            ))}
          </select>
          <button
            onClick={() => startTransition(async () => {
              const r = await takeMonthlySnapshot(currentMonth, currentYear)
              if (r.error) fb(`Error: ${r.error}`)
              else fb(`✓ Snapshot guardado para ${MONTH_NAMES_ES[(r.month! - 1)]} ${r.year}`)
            })}
            className="text-xs font-syne font-bold bg-go-orange text-white px-3 py-1.5 rounded-lg hover:bg-go-orange/90 transition"
          >
            📸 Guardar snapshot ahora
          </button>
        </div>
      </div>
      {feedback && (
        <p className={`text-sm font-dm px-3 py-2 rounded-lg ${feedback.startsWith('Error') ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>{feedback}</p>
      )}

      {/* Section 1 — MoM cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MomCard label="ACC Videos" current={totalAcc} mom={accMom} formatter={(n) => String(n)} />
        <MomCard label="TTD Videos" current={totalTtd} mom={ttdMom} formatter={(n) => String(n)} />
        <MomCard label="GMV Total" current={totalGmv} mom={gmvMom} formatter={(n) => `$${Math.round(n).toLocaleString('en-US')}`} />
        <MomCard label="Nuevas creadoras" current={newCreatorsThisMonth} mom={newMom} formatter={(n) => String(n)} />
      </div>

      {/* Section 2 — ACC vs TTD bars (last 6 months) */}
      <SectionCard>
        <div className="p-6">
          <h3 className="font-syne font-bold text-base text-go-dark mb-4">Videos por mes (últimos 6)</h3>
          <MonthlyAccTtdBars data={series} />
        </div>
      </SectionCard>

      {/* Section 3 — Two line charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard>
          <div className="p-6">
            <h3 className="font-syne font-bold text-base text-go-dark mb-4">GMV por mes</h3>
            <GmvLine data={series} />
          </div>
        </SectionCard>
        <SectionCard>
          <div className="p-6">
            <h3 className="font-syne font-bold text-base text-go-dark mb-4">Creadoras activas por mes</h3>
            <CreatorsLine data={series} />
          </div>
        </SectionCard>
      </div>

      {/* Section 4 — Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BreakdownCard
          title="👥 Creadoras Regulares"
          subtitle="Videos enviados por la comunidad"
          accent="orange"
          accNumber={regAcc}
          ttdNumber={regTtd}
          accBar={accGoal > 0 ? Math.min(100, (regAcc / accGoal) * 100) : 0}
          ttdBar={ttdGoal > 0 ? Math.min(100, (regTtd / ttdGoal) * 100) : 0}
          accPctOfTotal={totalAcc > 0 ? Math.round((regAcc / totalAcc) * 100) : 0}
          ttdPctOfTotal={totalTtd > 0 ? Math.round((regTtd / totalTtd) * 100) : 0}
          footer={`${regular.length} creadoras activas · ${regSubmitted} enviados · ${regValid} válidos · ${regPendingReview} sin revisar · ${regBoosted} boosteados`}
        />
        <BreakdownCard
          title="🏢 Equipo Interno"
          subtitle="Videos verificados del equipo interno"
          accent="green"
          accNumber={intAcc}
          ttdNumber={intTtd}
          accBar={accGoal > 0 ? Math.min(100, (intAcc / accGoal) * 100) : 0}
          ttdBar={ttdGoal > 0 ? Math.min(100, (intTtd / ttdGoal) * 100) : 0}
          accPctOfTotal={totalAcc > 0 ? Math.round((intAcc / totalAcc) * 100) : 0}
          ttdPctOfTotal={totalTtd > 0 ? Math.round((intTtd / totalTtd) * 100) : 0}
          footer={`${internal.length} creadoras internas activas`}
          warning={intPending > 0 ? `${intPending} pendientes de verificar` : null}
        />
      </div>

      <SectionCard>
        <div className="p-6">
          <h3 className="font-syne font-bold text-base text-go-dark mb-4">Total combinado este mes</h3>
          <CombinedBar label="ACC" current={totalAcc} goal={accGoal} barPct={accGoal > 0 ? Math.min(100, (totalAcc / accGoal) * 100) : 0} complete={accGoal > 0 && totalAcc >= accGoal} />
          <div className="h-4" />
          <CombinedBar label="TTD" current={totalTtd} goal={ttdGoal} barPct={ttdGoal > 0 ? Math.min(100, (totalTtd / ttdGoal) * 100) : 0} complete={ttdGoal > 0 && totalTtd >= ttdGoal} />
        </div>
      </SectionCard>

      {/* Section 5 — Top contributors */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <TopList
          title="🌟 Top ACC (Regulares)"
          rows={topAcc.map(c => ({ id: c.id, name: c.full_name ?? c.email, handle: c.tiktok_handle, value: c._v, valueLabel: 'ACC' }))}
          accent="orange"
        />
        <TopList
          title="🌟 Top TTD (Regulares)"
          rows={topTtd.map(c => ({ id: c.id, name: c.full_name ?? c.email, handle: c.tiktok_handle, value: c._v, valueLabel: 'TTD' }))}
          accent="pink"
        />
        <TopInternalList rows={topInt} />
      </div>

      {/* Section 6 — Historical snapshots table */}
      <SectionCard>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-syne font-bold text-base text-go-dark">Histórico de snapshots</h3>
            <button
              onClick={exportCsv}
              disabled={sortedSnapshots.length === 0}
              className="text-xs font-semibold bg-go-dark/[0.04] text-go-dark/70 hover:bg-go-dark/[0.08] px-3 py-1.5 rounded-lg disabled:opacity-40"
            >
              ⬇ Exportar CSV
            </button>
          </div>
          {sortedSnapshots.length === 0 ? (
            <p className="text-xs text-go-dark/40 py-4 text-center">No hay snapshots todavía. Pulsa &ldquo;Guardar snapshot ahora&rdquo; para crear el primero.</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-go-dark/5">
              <table className="w-full text-xs font-dm">
                <thead className="bg-go-dark/[0.03]">
                  <tr>
                    {['Mes', 'ACC', 'TTD', 'GMV', 'Creadoras', 'Nuevas', 'Int. ACC', 'Int. TTD', 'Guardado'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-[10px] text-go-dark/50 font-semibold uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-go-dark/5">
                  {sortedSnapshots.map(s => (
                    <tr key={s.id}>
                      <td className="px-3 py-2 font-semibold text-go-dark">{MONTH_NAMES_ES[s.month - 1]} {s.year}</td>
                      <td className="px-3 py-2">{s.total_acc_videos}</td>
                      <td className="px-3 py-2">{s.total_ttd_videos}</td>
                      <td className="px-3 py-2">${Math.round(Number(s.total_gmv)).toLocaleString('en-US')}</td>
                      <td className="px-3 py-2">{s.total_creators}</td>
                      <td className="px-3 py-2">{s.new_creators}</td>
                      <td className="px-3 py-2">{s.internal_acc_videos}</td>
                      <td className="px-3 py-2">{s.internal_ttd_videos}</td>
                      <td className="px-3 py-2 text-go-dark/40">{new Date(s.snapshot_taken_at).toLocaleDateString('es')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  )
}

function AdminDashboardTab({
  creators, internalVideos, boostRequests, creatorSnapshots, levelUpEvents, monthlyGoal, currentMonth, currentYear, startTransition,
}: {
  creators: Creator[]
  internalVideos: InternalVideo[]
  boostRequests: BoostRequest[]
  creatorSnapshots: CreatorSnapshot[]
  levelUpEvents: LevelUpEvent[]
  monthlyGoal: MonthlyGoal | null
  currentMonth: number
  currentYear: number
  startTransition: (cb: () => void) => void
}) {
  // ── Single source of truth for the entire Dashboard tab ──────────────
  // Every section below (rings, quick stats, breakdown cards, combined
  // bar, top lists) reads from the variables computed here. No parallel
  // filtering elsewhere — that's how we ended up with the rings, the
  // QuickStat, and the Creadoras card disagreeing on the same number.
  //
  // Month window: [startOfMonth, endOfMonth] inclusive. endOfMonth lands
  // on the 0th of next month at 23:59:59.999 so a row saved at the very
  // last second still counts. ISO strings compare lexicographically — no
  // Date() coercions per row.
  const startOfMonth = new Date(currentYear, currentMonth - 1, 1).toISOString()
  const endOfMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999).toISOString()

  // Active creators (used only for "Creadoras activas / Internas activas"
  // quick-stat counts — we do NOT filter video aggregates by active
  // status, since a video posted last week still counts even if the
  // creator was just paused).
  const active = creators.filter(c => c.status === 'active')
  const regular = active.filter(c => !c.is_internal)
  const internal = active.filter(c => c.is_internal)

  // 1. All boost requests this month (regular pipeline).
  const regularBoosts = boostRequests.filter(b => b.created_at >= startOfMonth && b.created_at <= endOfMonth)
  // 2. All internal videos this month.
  const internalVideosThisMonth = internalVideos.filter(v => v.submitted_at >= startOfMonth && v.submitted_at <= endOfMonth)

  // Diagnostic — surfaces is_valid distribution so "pending=0 but I see
  // pending videos" reports can be triaged from logs (SSR render fires
  // on the server; subsequent renders log to the browser console).
  // If the `invalid` bucket is unexpectedly large, the live DB likely
  // still carries the legacy DEFAULT false, and new inserts should be
  // picking up the explicit `is_valid: null` we now pass in
  // submitBoostBatch — old rows would need a one-time UPDATE.
  const isValidDist = regularBoosts.reduce(
    (acc, b) => {
      if (b.is_valid === true) acc.valid++
      else if (b.is_valid === false) acc.invalid++
      else if (b.is_valid === null || b.is_valid === undefined) acc.pending++
      else acc.unknown++
      return acc
    },
    { valid: 0, invalid: 0, pending: 0, unknown: 0 },
  )
  console.log(`[AdminDashboard] regularBoosts=${regularBoosts.length} window=[${startOfMonth}, ${endOfMonth}] is_valid dist=`, isValidDist)

  // Regular creators
  const regularAccApproved = regularBoosts.filter(b => b.video_type === 'ACC' && b.is_valid === true).length
  const regularTtdApproved = regularBoosts.filter(b => b.video_type === 'TTD' && b.is_valid === true).length
  const regularPending = regularBoosts.filter(b => b.is_valid === null || b.is_valid === undefined).length
  const regularSubmitted = regularBoosts.length
  const regularValidTotal = regularAccApproved + regularTtdApproved
  const regularBoosted = regularBoosts.filter(b => b.boost_status === 'boosteado').length

  // Internal team
  const internalAccApproved = internalVideosThisMonth.filter(v => v.video_type === 'ACC' && v.status === 'approved').length
  const internalTtdApproved = internalVideosThisMonth.filter(v => v.video_type === 'TTD' && v.status === 'approved').length
  // Pending internal verifications — not month-scoped, this is admin queue.
  const internalPending = internalVideos.filter(v => v.status === 'pending').length

  // Totals
  const totalAccApproved = regularAccApproved + internalAccApproved
  const totalTtdApproved = regularTtdApproved + internalTtdApproved
  const totalApproved = totalAccApproved + totalTtdApproved

  // Goals (fallback 300/300 if no monthly_goal row yet)
  const accGoal = monthlyGoal?.acc_goal ?? 300
  const ttdGoal = monthlyGoal?.ttd_goal ?? 300

  // Remaining
  const accRemaining = Math.max(0, accGoal - totalAccApproved)
  const ttdRemaining = Math.max(0, ttdGoal - totalTtdApproved)

  // Bars (capped at 100%). The combined-total bars were removed; the
  // remaining "share of total" bars on the BreakdownCards still need this
  // helper.
  const safe = (n: number, d: number) => d > 0 ? Math.min((n / d) * 100, 100) : 0
  // Per-subgroup bars on the BreakdownCards — fraction of the COMBINED
  // total, not the goal. Reading "Creadoras Regulares ACC: 55% of total"
  // is more honest than "55% of goal" when the goal is far off.
  const regAccShareBar = safe(regularAccApproved, totalAccApproved)
  const regTtdShareBar = safe(regularTtdApproved, totalTtdApproved)
  const intAccShareBar = safe(internalAccApproved, totalAccApproved)
  const intTtdShareBar = safe(internalTtdApproved, totalTtdApproved)
  const pctOfTotal = (part: number, total: number) => total > 0 ? Math.round((part / total) * 100) : 0

  // Top contributors — derive from the same regularBoosts (approved only).
  const accByCreator = new Map<string, number>()
  const ttdByCreator = new Map<string, number>()
  for (const b of regularBoosts) {
    if (!b.creator_id || b.is_valid !== true) continue
    if (b.video_type === 'ACC') accByCreator.set(b.creator_id, (accByCreator.get(b.creator_id) ?? 0) + 1)
    else if (b.video_type === 'TTD') ttdByCreator.set(b.creator_id, (ttdByCreator.get(b.creator_id) ?? 0) + 1)
  }
  const creatorsById = new Map(creators.map(c => [c.id, c]))
  const topRegularAcc = Array.from(accByCreator.entries())
    .map(([id, _acc]) => ({ creator: creatorsById.get(id), _acc }))
    .filter(x => x.creator)
    .sort((a, b) => b._acc - a._acc)
    .slice(0, 5)
    .map(x => ({ ...(x.creator as Creator), _acc: x._acc }))
  const topRegularTtd = Array.from(ttdByCreator.entries())
    .map(([id, _ttd]) => ({ creator: creatorsById.get(id), _ttd }))
    .filter(x => x.creator)
    .sort((a, b) => b._ttd - a._ttd)
    .slice(0, 5)
    .map(x => ({ ...(x.creator as Creator), _ttd: x._ttd }))

  // Top internal — same source of truth.
  const intByCreator = new Map<string, { acc: number; ttd: number }>()
  for (const v of internalVideosThisMonth) {
    if (!v.creator_id || v.status !== 'approved') continue
    const cur = intByCreator.get(v.creator_id) ?? { acc: 0, ttd: 0 }
    if (v.video_type === 'ACC') cur.acc++
    else if (v.video_type === 'TTD') cur.ttd++
    intByCreator.set(v.creator_id, cur)
  }
  const topInternal = Array.from(intByCreator.entries())
    .map(([id, counts]) => ({ creator: creatorsById.get(id), acc: counts.acc, ttd: counts.ttd, total: counts.acc + counts.ttd }))
    .filter(x => x.creator)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  // Activity alerts — derive from boost requests + creator snapshots.
  // classifyCreatorActivity now takes (thisMonth, last7Days), so we compute
  // the two windows we actually use and drop the unused 14d split.
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString()
  const prevD = new Date(currentYear, currentMonth - 2, 1)
  const prevM = prevD.getMonth() + 1
  const prevY = prevD.getFullYear()
  const lastMonthByCreator = new Map<string, CreatorSnapshot>()
  for (const s of creatorSnapshots) {
    if (s.month === prevM && s.year === prevY) lastMonthByCreator.set(s.creator_id, s)
  }
  let inactiveCount = 0
  let riskCount = 0
  let droppedCount = 0
  for (const c of regular) {
    const mine = boostRequests.filter(b => b.creator_id === c.id)
    const last7 = mine.filter(b => b.created_at >= sevenDaysAgo).length
    const thisMonth = mine.filter(b => b.created_at >= startOfMonth).length
    const status = classifyCreatorActivity(c, thisMonth, last7)
    if (status === 'inactive') inactiveCount++
    else if (status === 'risk') riskCount++
    const snap = lastMonthByCreator.get(c.id)
    if (snap && thisMonth < snap.total_videos) droppedCount++
  }
  const hasAlerts = inactiveCount > 0 || riskCount > 0 || droppedCount > 0

  // Level-ups this month
  const levelUpsThisMonth = levelUpEvents.filter((e) => e.leveled_up_at >= startOfMonth).length

  // Modals
  const [showResetMay, setShowResetMay] = useState(false)
  const [showImport, setShowImport] = useState(false)

  return (
    <div className="space-y-6">
      {showResetMay && <ResetMonthModal onClose={() => setShowResetMay(false)} startTransition={startTransition} />}
      {showImport && (
        <AdminVideoSubmitModal
          creators={creators}
          defaultDate="2026-05-01"
          onClose={() => setShowImport(false)}
          startTransition={startTransition}
        />
      )}

      {/* Destructive / bulk-import controls */}
      <div className="flex flex-wrap gap-2 justify-end">
        <button
          onClick={() => setShowImport(true)}
          className="text-xs font-syne font-bold bg-go-dark/[0.06] text-go-dark hover:bg-go-dark/[0.1] px-4 py-2 rounded-lg"
        >📥 Importar Videos de Mayo</button>
        <button
          onClick={() => setShowResetMay(true)}
          className="text-xs font-syne font-bold bg-red-500 text-white hover:bg-red-600 px-4 py-2 rounded-lg"
        >🔄 Reset Mayo</button>
      </div>

      {/* Celebration line — level-ups this month */}
      {levelUpsThisMonth > 0 && (
        <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-4 flex items-center justify-between flex-wrap gap-2">
          <p className="font-syne text-base font-bold text-emerald-800">
            🎉 {levelUpsThisMonth} {levelUpsThisMonth === 1 ? 'creadora subió' : 'creadoras subieron'} de nivel este mes
          </p>
          <p className="font-dm text-xs text-emerald-700/70">
            Revisa el historial en cada perfil 📈
          </p>
        </div>
      )}

      {/* Activity alerts — only shown when there's something to flag */}
      {hasAlerts && (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-5">
          <h3 className="font-syne font-bold text-base text-amber-900 mb-3">⚠️ Atención</h3>
          <ul className="space-y-1">
            {inactiveCount > 0 && (
              <li className="font-dm text-sm text-amber-900">
                <strong className="font-bold">{inactiveCount}</strong> creadoras inactivas (sin videos en 14+ días)
              </li>
            )}
            {riskCount > 0 && (
              <li className="font-dm text-sm text-amber-900">
                <strong className="font-bold">{riskCount}</strong> creadoras en riesgo (bajo cuota 2 semanas)
              </li>
            )}
            {droppedCount > 0 && (
              <li className="font-dm text-sm text-amber-900">
                <strong className="font-bold">{droppedCount}</strong> creadoras con menos videos que el mes pasado
              </li>
            )}
          </ul>
          <p className="font-dm text-xs text-amber-800/70 mt-2">Revisa la pestaña <strong>Creators</strong> para filtrar y atender.</p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-syne text-2xl font-bold text-go-dark">
            Dashboard — {MONTH_NAMES_ES[currentMonth - 1]} {currentYear}
          </h2>
          <p className="font-dm text-sm text-go-dark/50 mt-1">
            Meta del mes: <span className="font-semibold text-go-dark">{accGoal} ACC</span> · <span className="font-semibold text-go-dark">{ttdGoal} TTD</span>
          </p>
        </div>
      </div>

      {/* Section 1 — Two big rings */}
      <SectionCard>
        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <DashboardRing
              current={totalAccApproved}
              goal={accGoal}
              remaining={accRemaining}
              label="ACC Videos"
              color="#ff7700"
            />
            <DashboardRing
              current={totalTtdApproved}
              goal={ttdGoal}
              remaining={ttdRemaining}
              label="TTD Videos"
              color="#ec4899"
            />
          </div>
        </div>
      </SectionCard>

      {/* Quick stats — every number sources from the centralized block
          above so the rings, cards, and stat tiles cannot drift. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <QuickStat label="Total videos aprobados" value={totalApproved} accent="dark" />
        <QuickStat label="Pendientes de revisión" value={regularPending} accent="pink" />
        <QuickStat label="Creadoras activas" value={regular.length} accent="orange" />
        <QuickStat label="Internas activas" value={internal.length} accent="green" />
      </div>

      {/* Section 2 — Breakdown cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BreakdownCard
          title="👥 Creadoras Regulares"
          subtitle="Videos reportados por la comunidad"
          accent="orange"
          accNumber={regularAccApproved}
          ttdNumber={regularTtdApproved}
          accBar={regAccShareBar}
          ttdBar={regTtdShareBar}
          accPctOfTotal={pctOfTotal(regularAccApproved, totalAccApproved)}
          ttdPctOfTotal={pctOfTotal(regularTtdApproved, totalTtdApproved)}
          footer={`${regular.length} creadoras activas · ${regularSubmitted} enviados · ${regularValidTotal} válidos · ${regularPending} sin revisar · ${regularBoosted} boosteados`}
        />
        <BreakdownCard
          title="🏢 Equipo Interno"
          subtitle="Videos verificados del equipo interno"
          accent="green"
          accNumber={internalAccApproved}
          ttdNumber={internalTtdApproved}
          accBar={intAccShareBar}
          ttdBar={intTtdShareBar}
          accPctOfTotal={pctOfTotal(internalAccApproved, totalAccApproved)}
          ttdPctOfTotal={pctOfTotal(internalTtdApproved, totalTtdApproved)}
          footer={`${internal.length} creadoras internas activas`}
          warning={internalPending > 0 ? `${internalPending} videos pendientes de verificar` : null}
        />
      </div>

      {/* Combined total bars removed — the two rings already convey the
          same totals, so the duplicate row was visual noise. */}

      {/* Section 3 — Top contributors */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <TopList
          title="🌟 Top ACC (Regulares)"
          rows={topRegularAcc.map(c => ({
            id: c.id,
            name: c.full_name ?? c.email,
            handle: c.tiktok_handle,
            value: c._acc,
            valueLabel: 'ACC',
          }))}
          accent="orange"
        />
        <TopList
          title="🌟 Top TTD (Regulares)"
          rows={topRegularTtd.map(c => ({
            id: c.id,
            name: c.full_name ?? c.email,
            handle: c.tiktok_handle,
            value: c._ttd,
            valueLabel: 'TTD',
          }))}
          accent="pink"
        />
        <TopInternalList rows={topInternal} />
      </div>

      {/* Section 4 — Per-creator video tracker */}
      <VideoTrackerSection
        regular={regular}
        boostRequests={boostRequests}
        startTransition={startTransition}
      />

      {/* Section 5 — Monthly goal editor */}
      <MonthlyGoalEditor
        month={currentMonth}
        year={currentYear}
        accGoal={accGoal}
        ttdGoal={ttdGoal}
        lastUpdated={monthlyGoal?.updated_at ?? monthlyGoal?.created_at ?? null}
        startTransition={startTransition}
      />
    </div>
  )
}

function BreakdownCard({
  title, subtitle, accent, accNumber, ttdNumber, accBar, ttdBar, accPctOfTotal, ttdPctOfTotal, footer, warning,
}: {
  title: string
  subtitle: string
  accent: 'orange' | 'green'
  accNumber: number
  ttdNumber: number
  accBar: number
  ttdBar: number
  accPctOfTotal: number
  ttdPctOfTotal: number
  footer: string
  warning?: string | null
}) {
  const ringClass = accent === 'green' ? 'border-emerald-200' : 'border-go-orange/20'
  return (
    <div className={`bg-white border-2 ${ringClass} rounded-2xl p-6`}>
      <h3 className="font-syne font-bold text-lg text-go-dark">{title}</h3>
      <p className="font-dm text-xs text-go-dark/50 mt-1 mb-5">{subtitle}</p>

      <div className="grid grid-cols-2 gap-4 mb-5">
        <div>
          <p className="font-dm text-xs uppercase tracking-wide text-go-dark/40">ACC</p>
          <p className="font-syne font-bold text-3xl text-[#ff7700] mt-0.5 leading-none">{accNumber}</p>
          <div className="mt-2 h-2 rounded-full bg-go-dark/[0.06] overflow-hidden">
            <div className="h-full bg-[#ff7700] transition-all" style={{ width: `${accBar}%` }} />
          </div>
          <span className="inline-block mt-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#ff7700]/10 text-[#ff7700]">
            Aportan {accPctOfTotal}% del total ACC
          </span>
        </div>
        <div>
          <p className="font-dm text-xs uppercase tracking-wide text-go-dark/40">TTD</p>
          <p className="font-syne font-bold text-3xl text-pink-600 mt-0.5 leading-none">{ttdNumber}</p>
          <div className="mt-2 h-2 rounded-full bg-go-dark/[0.06] overflow-hidden">
            <div className="h-full bg-pink-500 transition-all" style={{ width: `${ttdBar}%` }} />
          </div>
          <span className="inline-block mt-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-pink-100 text-pink-700">
            Aportan {ttdPctOfTotal}% del total TTD
          </span>
        </div>
      </div>

      <p className="font-dm text-xs text-go-dark/60 border-t border-go-dark/[0.06] pt-3">
        {footer}
      </p>
      {warning && (
        <p className="font-dm text-xs text-[#ff7700] font-semibold mt-2">⚠ {warning}</p>
      )}
    </div>
  )
}

function CombinedBar({ label, current, goal, barPct, complete }: { label: string; current: number; goal: number; barPct: number; complete: boolean }) {
  const color = complete ? '#2a9d4a' : '#ff7700'
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="font-dm text-sm font-semibold text-go-dark">{label}</span>
        <span className="font-dm text-sm text-go-dark/60">
          <span className="font-syne font-bold text-go-dark text-base">{current}</span> de {goal} {label}
        </span>
      </div>
      <div className="h-3 rounded-full bg-go-dark/[0.06] overflow-hidden">
        <div className="h-full transition-all" style={{ width: `${barPct}%`, background: color }} />
      </div>
    </div>
  )
}

function TopList({ title, rows, accent }: { title: string; rows: { id: string; name: string; handle: string | null; value: number; valueLabel: string }[]; accent: 'orange' | 'pink' }) {
  const colors = accent === 'pink'
    ? { rank: 'text-pink-600', value: 'text-pink-700 bg-pink-100' }
    : { rank: 'text-[#ff7700]', value: 'text-[#ff7700] bg-[#ff7700]/10' }
  return (
    <SectionCard>
      <div className="p-5">
        <h3 className="font-syne font-bold text-sm text-go-dark mb-4">{title}</h3>
        {rows.length === 0 ? (
          <p className="font-dm text-xs text-go-dark/40 text-center py-4">Aún no hay datos.</p>
        ) : (
          <ol className="space-y-2">
            {rows.map((r, i) => (
              <li key={r.id} className="flex items-center gap-3 py-1.5">
                <span className={`font-syne font-bold text-base w-6 text-center ${colors.rank}`}>#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-dm text-sm font-medium text-go-dark truncate">{r.name}</p>
                  {r.handle && <p className="font-dm text-xs text-go-dark/50 truncate">{r.handle}</p>}
                </div>
                <span className={`font-syne font-bold text-xs px-2 py-0.5 rounded-full ${colors.value} shrink-0`}>
                  {r.value} {r.valueLabel}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </SectionCard>
  )
}

function TopInternalList({ rows }: { rows: { creator?: Creator; acc: number; ttd: number; total: number }[] }) {
  return (
    <SectionCard>
      <div className="p-5">
        <h3 className="font-syne font-bold text-sm text-go-dark mb-4">🏢 Top Equipo Interno</h3>
        {rows.length === 0 ? (
          <p className="font-dm text-xs text-go-dark/40 text-center py-4">Aún no hay videos verificados.</p>
        ) : (
          <ol className="space-y-2">
            {rows.map((r, i) => (
              <li key={r.creator!.id} className="flex items-center gap-3 py-1.5">
                <span className="font-syne font-bold text-base w-6 text-center text-emerald-600">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-dm text-sm font-medium text-go-dark truncate">{r.creator!.full_name ?? r.creator!.email}</p>
                  {r.creator!.tiktok_handle && <p className="font-dm text-xs text-go-dark/50 truncate">{r.creator!.tiktok_handle}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">{r.acc} ACC</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-pink-100 text-pink-700">{r.ttd} TTD</span>
                  <span className="text-xs font-syne font-bold text-go-dark ml-1">{r.total}</span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </SectionCard>
  )
}
