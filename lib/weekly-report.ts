import type { SupabaseClient } from '@supabase/supabase-js'

const SPANISH_MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

export type WeeklyReport = {
  /** "Semana del 13 de mayo al 19 de mayo" */
  weekLabel: string
  weekStartIso: string
  weekEndIso: string
  totalAcc: number
  totalTtd: number
  totalVideos: number
  newCreators: number
  levelUps: number
  top5: {
    name: string
    tiktokHandle: string | null
    acc: number
    ttd: number
    total: number
  }[]
  perCreator: {
    name: string
    tiktokHandle: string | null
    nivel: number
    accThisWeek: number
    ttdThisWeek: number
    gmvThisMonth: number
    totalVideosMonth: number
  }[]
}

/**
 * Returns the [Mon 00:00 UTC, Sun 23:59:59.999 UTC] window of the most
 * recently completed week. Called from the Monday-8am cron (window is
 * "last week") and from the manual export (same — "esta semana" in
 * Spanish referring to the report's name, not literally today's week).
 */
function computeLastWeekWindow(now: Date = new Date()) {
  const dayUtc = now.getUTCDay() // 0=Sun..6=Sat
  // Days since this week's Monday (UTC). Sun=6, Mon=0, Tue=1, ...
  const daysSinceThisMonday = (dayUtc + 6) % 7

  const start = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - daysSinceThisMonday - 7,
    0, 0, 0, 0,
  ))
  const end = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - daysSinceThisMonday - 1,
    23, 59, 59, 999,
  ))
  const fmt = (d: Date) => `${d.getUTCDate()} de ${SPANISH_MONTHS[d.getUTCMonth()]}`
  return {
    weekStartIso: start.toISOString(),
    weekEndIso: end.toISOString(),
    weekLabel: `Semana del ${fmt(start)} al ${fmt(end)}`,
  }
}

/**
 * Compute the manager weekly report — counts of approved boosts,
 * new approved creators, level-ups, top 5 by approved videos this
 * week, plus per-creator detail. All numbers count is_valid=true
 * boosts only.
 *
 * The shape is shared by the cron (writes to Google Sheets) and the
 * manual admin export button (downloads CSV or appends to Sheets).
 */
export async function computeWeeklyReport(
  admin: SupabaseClient,
): Promise<WeeklyReport> {
  const { weekStartIso, weekEndIso, weekLabel } = computeLastWeekWindow()

  type Boost = { creator_id: string; video_type: 'ACC' | 'TTD' | null; is_valid: boolean | null; created_at: string }
  type Creator = {
    id: string
    full_name: string | null
    tiktok_handle: string | null
    nivel: number
    status: string
    gmv_this_month: number | null
    videos_this_month: number | null
    approved_at: string | null
  }
  type LevelUp = { id: string; leveled_up_at: string }

  const [boostsRes, creatorsRes, levelUpsRes] = await Promise.all([
    admin
      .from('go_boost_requests')
      .select('creator_id, video_type, is_valid, created_at')
      .eq('is_valid', true)
      .gte('created_at', weekStartIso)
      .lte('created_at', weekEndIso),
    admin
      .from('go_creators')
      .select('id, full_name, tiktok_handle, nivel, status, gmv_this_month, videos_this_month, approved_at')
      .eq('status', 'active'),
    admin
      .from('go_level_up_events')
      .select('id, leveled_up_at')
      .gte('leveled_up_at', weekStartIso)
      .lte('leveled_up_at', weekEndIso),
  ])

  if (boostsRes.error) throw boostsRes.error
  if (creatorsRes.error) throw creatorsRes.error
  if (levelUpsRes.error) throw levelUpsRes.error

  const boosts = (boostsRes.data ?? []) as Boost[]
  const creators = (creatorsRes.data ?? []) as Creator[]
  const levelUps = (levelUpsRes.data ?? []) as LevelUp[]

  const totalAcc = boosts.filter((b) => b.video_type === 'ACC').length
  const totalTtd = boosts.filter((b) => b.video_type === 'TTD').length
  const totalVideos = totalAcc + totalTtd
  const newCreators = creators.filter(
    (c) => c.approved_at && c.approved_at >= weekStartIso && c.approved_at <= weekEndIso,
  ).length

  const boostsByCreator = new Map<string, Boost[]>()
  for (const b of boosts) {
    const list = boostsByCreator.get(b.creator_id) ?? []
    list.push(b)
    boostsByCreator.set(b.creator_id, list)
  }

  const perCreator: WeeklyReport['perCreator'] = creators
    .map((c) => {
      const mine = boostsByCreator.get(c.id) ?? []
      const accWeek = mine.filter((b) => b.video_type === 'ACC').length
      const ttdWeek = mine.filter((b) => b.video_type === 'TTD').length
      return {
        name: c.full_name ?? '—',
        tiktokHandle: c.tiktok_handle,
        nivel: c.nivel,
        accThisWeek: accWeek,
        ttdThisWeek: ttdWeek,
        gmvThisMonth: Number(c.gmv_this_month ?? 0),
        totalVideosMonth: c.videos_this_month ?? 0,
      }
    })
    // Top of list = most active this week so the sheet is useful at
    // a glance. Inactive (0/0) creators sink to the bottom.
    .sort((a, b) => (b.accThisWeek + b.ttdThisWeek) - (a.accThisWeek + a.ttdThisWeek) || a.name.localeCompare(b.name))

  const top5 = perCreator
    .filter((c) => c.accThisWeek + c.ttdThisWeek > 0)
    .slice(0, 5)
    .map((c) => ({
      name: c.name,
      tiktokHandle: c.tiktokHandle,
      acc: c.accThisWeek,
      ttd: c.ttdThisWeek,
      total: c.accThisWeek + c.ttdThisWeek,
    }))

  return {
    weekLabel,
    weekStartIso,
    weekEndIso,
    totalAcc,
    totalTtd,
    totalVideos,
    newCreators,
    levelUps: levelUps.length,
    top5,
    perCreator,
  }
}

// ── Formatters ──────────────────────────────────────────────

function csvField(s: string | number | null | undefined): string {
  const str = String(s ?? '')
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}
function csvRow(fields: (string | number | null | undefined)[]): string {
  return fields.map(csvField).join(',')
}

export function formatReportAsCsv(report: WeeklyReport): string {
  const lines: string[] = []
  lines.push(csvRow([`Reporte Semanal Papaya GO — ${report.weekLabel}`]))
  lines.push('')
  lines.push(csvRow(['RESUMEN']))
  lines.push(csvRow(['ACC esta semana', report.totalAcc]))
  lines.push(csvRow(['TTD esta semana', report.totalTtd]))
  lines.push(csvRow(['Videos totales', report.totalVideos]))
  lines.push(csvRow(['Creadoras nuevas', report.newCreators]))
  lines.push(csvRow(['Level ups', report.levelUps]))
  lines.push('')
  lines.push(csvRow(['TOP 5 ESTA SEMANA']))
  lines.push(csvRow(['Nombre', '@Handle', 'ACC', 'TTD', 'Total']))
  for (const t of report.top5) {
    lines.push(csvRow([t.name, t.tiktokHandle ?? '', t.acc, t.ttd, t.total]))
  }
  if (report.top5.length === 0) lines.push(csvRow(['(sin actividad esta semana)']))
  lines.push('')
  lines.push(csvRow(['DETALLE POR CREADORA']))
  lines.push(csvRow(['Nombre', '@Handle', 'Nivel', 'ACC semana', 'TTD semana', 'GMV mes', 'Total mes', 'Activa']))
  for (const c of report.perCreator) {
    const activa = c.accThisWeek + c.ttdThisWeek > 0 ? 'Sí' : 'No'
    lines.push(csvRow([
      c.name,
      c.tiktokHandle ?? '',
      c.nivel,
      c.accThisWeek,
      c.ttdThisWeek,
      c.gmvThisMonth,
      c.totalVideosMonth,
      activa,
    ]))
  }
  return lines.join('\n')
}

