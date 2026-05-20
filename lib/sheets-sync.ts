import { google, type sheets_v4 } from 'googleapis'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Hard-coded sheet ID (the "master" weekly tracking sheet shared with
 * the service account). Allow override via env so we can point at a
 * staging sheet during local development without code changes.
 */
const MASTER_SHEET_ID = process.env.MASTER_SHEET_ID ?? '15yy5K7V1wqgQSkbpp4XMABWk2wpjrSJ5wG_UZBC_ZxY'

/** Public link to the master sheet — surfaced in API responses so
 *  client UIs don't have to re-encode the ID. */
export function masterSheetUrl(): string {
  return `https://docs.google.com/spreadsheets/d/${MASTER_SHEET_ID}/edit`
}
// Tab names in the master sheet use emoji prefixes. The API treats
// the tab title as an opaque string — the literal must match exactly
// or Sheets returns "Unable to parse range" / "operation not
// supported for this document". The trailing space after the emoji
// is part of the actual title.
const CREATORS_TAB = '📌 CREATORS'
const DASHBOARD_TAB = '📊 DASHBOARD MAYO'
const DASHBOARD_ANUAL_TAB = '📅 DASHBOARD ANUAL'
const CONTENT_TAB = '🎬 CONTENT'

const SPANISH_MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

// ── CREATORS tab fixed layout ──────────────────────────────
//
// The tab has multiple sections in fixed positions; we don't search
// for column headers because the real sheet has merged headers
// spanning multiple rows. All indices below are 0-based for columns
// and 1-based for sheet rows (matching A1 notation).
//
// Rows 1-2: titles
// Row 3: section header "📅 TOTALES DEL EQUIPO POR SEMANA"
// Rows 4-9: team totals (one per metric, S1..S4 in cols B..E)
// Row 10: section header "📋 REGISTRO POR CREADORA"
// Row 11: super-headers (INFO | MES ANTERIOR | S1 | S2 | S3 | S4 | RESUMEN)
// Row 12: column headers (Nombre, @Handle, Nicho, …)
// Row 13+: per-creator data

const CREATORS_DATA_START_ROW = 13

/** 0-based column indices for the per-creator data rows. */
const CREATORS_COL = {
  nombre: 0,        // A
  handle: 1,        // B
  nicho: 2,         // C
  tier: 3,          // D
  fechaLinkeo: 4,   // E
  accLast: 5,       // F  (ACC mes ant.)
  ttdLast: 6,       // G  (TTD mes ant.)
  // Per-week ACC / TTD / GMV cluster, 3 cols per week
  accS: [7, 10, 13, 16] as const,   // H, K, N, Q
  ttdS: [8, 11, 14, 17] as const,   // I, L, O, R
  gmvS: [9, 12, 15, 18] as const,   // J, M, P, S
  totalPosts: 19,   // T
  totalGmv: 20,     // U
  // Fidelidad % (col V) is admin-maintained — we don't touch it.
} as const

/** Team totals — 1-based sheet rows. Cols B/C/D/E = S1/S2/S3/S4. */
const TEAM_TOTALS_ROW = {
  nuevas: 4,
  accPosts: 5,
  ttdPosts: 6,
  gmvSemana: 7,
  activas: 8,
  conGmv: 9,
} as const

/** 0-based column indices for team totals — B..E. */
const TEAM_TOTALS_COLS = [1, 2, 3, 4] as const

/**
 * Map day-of-month → week-of-month bucket (1..4). Used by the cron
 * column dispatch — videos with created_at in day 1..7 land in S1,
 * 8..14 in S2, etc. Day 29..31 collapses into S4 since most months
 * don't have a real "S5".
 */
export function weekOfMonth(date: Date): 1 | 2 | 3 | 4 {
  const day = date.getUTCDate()
  if (day <= 7) return 1
  if (day <= 14) return 2
  if (day <= 21) return 3
  return 4
}

// ── Auth ───────────────────────────────────────────────────

async function getSheetsClient(): Promise<sheets_v4.Sheets> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!raw) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON env var not configured in Vercel — Sheets sync cannot run.')
  }
  let credentials: { client_email?: string; private_key?: string }
  try {
    credentials = JSON.parse(raw)
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON.')
  }
  if (!credentials.client_email || !credentials.private_key) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON missing client_email or private_key.')
  }
  // When the JSON is pasted into a Vercel env field, newlines inside
  // private_key may end up as literal "\n". googleapis won't parse a
  // PEM without real newlines so we normalize defensively.
  credentials.private_key = credentials.private_key.replace(/\\n/g, '\n')

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
  return google.sheets({ version: 'v4', auth })
}

// ── Helpers ────────────────────────────────────────────────

/** Convert 0-based column index → A1 letters (0→A, 25→Z, 26→AA). */
function colLetter(idx: number): string {
  let n = idx
  let s = ''
  while (true) {
    s = String.fromCharCode(65 + (n % 26)) + s
    n = Math.floor(n / 26) - 1
    if (n < 0) return s
  }
}

function quoteTab(name: string): string {
  return `'${name.replace(/'/g, "''")}'`
}

/** Normalize a header cell for tolerant matching. */
function normHeader(s: unknown): string {
  return String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function findRow(rows: string[][], label: string): number {
  const target = normHeader(label)
  return rows.findIndex((r) => normHeader(r[0]) === target)
}

function monthStartIso(d: Date): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0)).toISOString()
}
function monthEndIso(d: Date): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59, 999)).toISOString()
}

// ── Types ──────────────────────────────────────────────────

type Boost = {
  creator_id: string
  video_type: 'ACC' | 'TTD' | null
  is_valid: boolean | null
  created_at: string
}
type CreatorRow = {
  id: string
  full_name: string | null
  tiktok_handle: string | null
  nivel: number
  status: string
  is_internal: boolean | null
  gmv_this_month: number | null
  created_at: string | null
  approved_at: string | null
}

export type SyncSummary = {
  syncedAt: string
  /** Convenience URL for the admin UI to deep-link into the sheet. */
  sheetUrl: string
  currentWeek: 1 | 2 | 3 | 4
  creatorsTab: {
    updated: number
    appended: number
    total: number
    teamTotalsUpdated: string[]
  }
  dashboardTab: { updatedLabels: string[] }
  contentTab: { updatedLabels: string[] }
  dashboardAnualTab: { updatedLabels: string[]; monthColumn: string | null }
  totals: {
    accThisMonth: number
    ttdThisMonth: number
    gmvThisMonthSum: number
    newCreatorsThisMonth: number
    activeCreatorsCount: number
    creatorsWithGmvCount: number
  }
}

// ── Sync orchestrator ──────────────────────────────────────

// ── Logged Sheets API wrappers ─────────────────────────────
//
// Every Sheets API failure surfaces here, prefixed with which tab +
// which exact A1 range tripped it. Without these wrappers a single
// "Unable to parse range" buried inside a batchUpdate gives no clue
// which cell is bad; here you can grep [sheets-sync:📌 CREATORS] and
// see the exact A1 + the upstream message in one line.

async function safeGet(
  sheets: sheets_v4.Sheets,
  tabLabel: string,
  range: string,
): Promise<string[][]> {
  try {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: MASTER_SHEET_ID, range })
    return (res.data.values ?? []) as string[][]
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(`[sheets-sync:${tabLabel}] read failed range=${range}: ${msg}`)
    throw new Error(`${tabLabel} read ${range}: ${msg}`)
  }
}

async function safeBatchUpdate(
  sheets: sheets_v4.Sheets,
  tabLabel: string,
  data: sheets_v4.Schema$ValueRange[],
): Promise<void> {
  if (data.length === 0) return
  try {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: MASTER_SHEET_ID,
      requestBody: { valueInputOption: 'USER_ENTERED', data },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const ranges = data.map((d) => d.range).join(', ')
    console.error(`[sheets-sync:${tabLabel}] batchUpdate failed (${data.length} ranges): ${msg}`)
    console.error(`[sheets-sync:${tabLabel}] failing ranges: ${ranges}`)
    throw new Error(`${tabLabel} batchUpdate (${data.length} ranges): ${msg}`)
  }
}

/**
 * Preflight — fetch sheet metadata, log every tab title, return the
 * set of titles. Each per-tab writer consults this set before
 * attempting a values.get so we surface a useful "tab not found"
 * error instead of letting Google return the inscrutable "Unable to
 * parse range" / "This operation is not supported for this document".
 */
async function preflight(sheets: sheets_v4.Sheets): Promise<Set<string>> {
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId: MASTER_SHEET_ID })
    const titles = (meta.data.sheets ?? [])
      .map((s) => s.properties?.title ?? '')
      .filter(Boolean)
    console.log(`[sheets-sync:preflight] master=${MASTER_SHEET_ID} tabs=${JSON.stringify(titles)}`)
    return new Set(titles)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(`[sheets-sync:preflight] failed to read metadata: ${msg}`)
    throw new Error(
      `No pude leer el sheet ${MASTER_SHEET_ID}. Verifica que esté compartido como Editor con la service account. (${msg})`,
    )
  }
}

/** Returned by the orchestrator when a tab the user asked us to update
 *  doesn't actually exist in the spreadsheet — we keep going (the
 *  other tabs are independent) and surface the miss in the response. */
function skipTab(name: string, tabSet: Set<string>): { updatedLabels: string[] } {
  console.warn(
    `[sheets-sync] tab "${name}" not found, skipping. Available: ${Array.from(tabSet).join(', ')}`,
  )
  return { updatedLabels: [] }
}
function skipTabAnual(name: string, tabSet: Set<string>): { updatedLabels: string[]; monthColumn: string | null } {
  console.warn(
    `[sheets-sync] tab "${name}" not found, skipping. Available: ${Array.from(tabSet).join(', ')}`,
  )
  return { updatedLabels: [], monthColumn: null }
}

export async function syncSheets(admin: SupabaseClient): Promise<SyncSummary> {
  const sheets = await getSheetsClient()
  const tabSet = await preflight(sheets)
  const now = new Date()
  const currentWeek = weekOfMonth(now)
  const startIso = monthStartIso(now)
  const endIso = monthEndIso(now)

  const [creatorsRes, boostsRes] = await Promise.all([
    admin
      .from('go_creators')
      .select('id, full_name, tiktok_handle, nivel, status, is_internal, gmv_this_month, created_at, approved_at')
      .eq('is_internal', false),
    admin
      .from('go_boost_requests')
      .select('creator_id, video_type, is_valid, created_at')
      .eq('is_valid', true)
      .gte('created_at', startIso)
      .lte('created_at', endIso),
  ])

  if (creatorsRes.error) throw new Error(`creators: ${creatorsRes.error.message}`)
  if (boostsRes.error) throw new Error(`boost_requests: ${boostsRes.error.message}`)

  const creators = (creatorsRes.data ?? []) as CreatorRow[]
  const boosts = (boostsRes.data ?? []) as Boost[]

  // ── Aggregate per-creator weekly counts (recomputed in full every
  // sync so a late-validated S1 video shows up retroactively next
  // week — idempotent) ───────────────────────────────────
  type WeekBuckets = { acc: [number, number, number, number]; ttd: [number, number, number, number] }
  const byCreator = new Map<string, WeekBuckets>()
  for (const c of creators) byCreator.set(c.id, { acc: [0, 0, 0, 0], ttd: [0, 0, 0, 0] })
  for (const b of boosts) {
    const w = weekOfMonth(new Date(b.created_at)) - 1
    const bucket = byCreator.get(b.creator_id)
    if (!bucket) continue // boost from internal creator or deleted account
    if (b.video_type === 'ACC') bucket.acc[w] += 1
    else if (b.video_type === 'TTD') bucket.ttd[w] += 1
  }

  // Compute the team-totals we need across multiple tabs once, then
  // pass into each tab writer.
  const accThisMonth = boosts.filter((b) => b.video_type === 'ACC').length
  const ttdThisMonth = boosts.filter((b) => b.video_type === 'TTD').length
  const gmvThisMonthSum = creators
    .filter((c) => c.status === 'active')
    .reduce((s, c) => s + Number(c.gmv_this_month ?? 0), 0)
  const newCreatorsThisMonth = creators.filter(
    (c) => c.approved_at && c.approved_at >= startIso && c.approved_at <= endIso,
  ).length
  const activeCreatorsCount = creators.filter((c) => c.status === 'active').length
  const creatorsWithGmvCount = creators.filter((c) => Number(c.gmv_this_month ?? 0) > 0).length

  // Per-week count of creators with at least one approved video.
  const activeCreatorsByWeek: [number, number, number, number] = [0, 0, 0, 0]
  byCreator.forEach((b) => {
    for (let w = 0; w < 4; w++) {
      if (b.acc[w] + b.ttd[w] > 0) activeCreatorsByWeek[w] += 1
    }
  })

  // Per-week ACC and TTD totals across all non-internal creators.
  const accByWeek: [number, number, number, number] = [0, 0, 0, 0]
  const ttdByWeek: [number, number, number, number] = [0, 0, 0, 0]
  byCreator.forEach((b) => {
    for (let w = 0; w < 4; w++) {
      accByWeek[w] += b.acc[w]
      ttdByWeek[w] += b.ttd[w]
    }
  })

  // Per-week count of NEW creators incorporated this month, bucketed
  // by the week-of-month of their approved_at. Used by the CREATORS
  // tab "Nuevas Incorporadas" team-totals row.
  const newCreatorsByWeek: [number, number, number, number] = [0, 0, 0, 0]
  for (const c of creators) {
    if (!c.approved_at) continue
    if (c.approved_at < startIso || c.approved_at > endIso) continue
    const w = weekOfMonth(new Date(c.approved_at)) - 1
    newCreatorsByWeek[w] += 1
  }

  if (!tabSet.has(CREATORS_TAB)) {
    throw new Error(
      `Tab "${CREATORS_TAB}" no existe en el sheet. Tabs disponibles: ${Array.from(tabSet).join(', ')}`,
    )
  }

  const creatorsTabSummary = await syncToCreatorsTab(
    sheets,
    creators,
    byCreator,
    currentWeek,
    {
      accByWeek,
      ttdByWeek,
      activeCreatorsByWeek,
      newCreatorsByWeek,
      creatorsWithGmvCount,
      gmvThisMonthSum,
    },
  )
  const dashboardTabSummary = tabSet.has(DASHBOARD_TAB)
    ? await syncToDashboardTab(sheets, creators, byCreator, currentWeek, startIso, endIso)
    : skipTab(DASHBOARD_TAB, tabSet)
  const contentTabSummary = tabSet.has(CONTENT_TAB)
    ? await syncToContentTab(sheets, accByWeek, ttdByWeek)
    : skipTab(CONTENT_TAB, tabSet)
  const dashboardAnualTabSummary = tabSet.has(DASHBOARD_ANUAL_TAB)
    ? await syncToDashboardAnualTab(sheets, now, {
        nuevasCriadoras: newCreatorsThisMonth,
        totalActivas: activeCreatorsCount,
        accPosts: accThisMonth,
        ttdPosts: ttdThisMonth,
        gmvTotal: gmvThisMonthSum,
      })
    : skipTabAnual(DASHBOARD_ANUAL_TAB, tabSet)

  return {
    syncedAt: now.toISOString(),
    sheetUrl: masterSheetUrl(),
    currentWeek,
    creatorsTab: creatorsTabSummary,
    dashboardTab: dashboardTabSummary,
    contentTab: contentTabSummary,
    dashboardAnualTab: dashboardAnualTabSummary,
    totals: {
      accThisMonth,
      ttdThisMonth,
      gmvThisMonthSum,
      newCreatorsThisMonth,
      activeCreatorsCount,
      creatorsWithGmvCount,
    },
  }
}

// ── CREATORS tab ───────────────────────────────────────────

type CreatorsTotals = {
  /** Per-week ACC across all non-internal creators. */
  accByWeek: [number, number, number, number]
  /** Per-week TTD across all non-internal creators. */
  ttdByWeek: [number, number, number, number]
  /** Per-week count of creators with at least one approved video. */
  activeCreatorsByWeek: [number, number, number, number]
  /** Per-week count of creators incorporated in that week of this month. */
  newCreatorsByWeek: [number, number, number, number]
  /** Right-now count of creators with gmv_this_month > 0. */
  creatorsWithGmvCount: number
  /** Sum of gmv_this_month across active creators. */
  gmvThisMonthSum: number
}

/**
 * Sync the 📌 CREATORS tab — fixed-layout writer.
 *
 * The tab is a custom-designed report (not a generic table) so we
 * don't header-detect. Two distinct sections, both at known
 * coordinates:
 *
 *   Rows 4-9 — team totals (cols B..E = S1..S4)
 *   Rows 13+ — per-creator data (cols A..V per CREATORS_COL)
 *
 * Per-creator lookup reads column B from row 13 down and matches by
 * normalized @handle. Creators not in the sheet get appended after
 * the last filled row. Untouched columns (Nicho, Tier, Fecha Linkeo,
 * ACC/TTD mes ant., Fidelidad %) are preserved because we write each
 * managed cell individually.
 */
async function syncToCreatorsTab(
  sheets: sheets_v4.Sheets,
  creators: CreatorRow[],
  byCreator: Map<string, { acc: number[]; ttd: number[] }>,
  currentWeek: 1 | 2 | 3 | 4,
  totals: CreatorsTotals,
): Promise<{ updated: number; appended: number; total: number; teamTotalsUpdated: string[] }> {
  // 1) Read column B starting at row 13 to find which @handles
  // already have rows. Range goes wide (200 rows) and we use the
  // length of the response to know where to append new rows.
  const handleRange = `${quoteTab(CREATORS_TAB)}!B${CREATORS_DATA_START_ROW}:B500`
  const handleRows = await safeGet(sheets, CREATORS_TAB, handleRange)
  console.log(
    `[sheets-sync:${CREATORS_TAB}] data-rows scanned=${handleRows.length} starting=row ${CREATORS_DATA_START_ROW}`,
  )

  // Map normalized handle → 1-based sheet row (so first data row = 13).
  const handleToRow = new Map<string, number>()
  // Track the last row that had a handle so we know where to append.
  let lastDataRow = CREATORS_DATA_START_ROW - 1
  for (let i = 0; i < handleRows.length; i++) {
    const raw = handleRows[i]?.[0]
    const key = normalizeHandle(raw)
    const sheetRow = CREATORS_DATA_START_ROW + i
    if (key) {
      handleToRow.set(key, sheetRow)
      lastDataRow = sheetRow
    }
  }

  const updateRequests: sheets_v4.Schema$ValueRange[] = []
  const appendRows: (string | number)[][] = []
  let updated = 0
  let appended = 0

  // Reusable helper: stage a single-cell write for the per-creator
  // section. Targets a specific (row, col) by name — keeps the
  // column → field mapping in one place.
  const pushCell = (row: number, col: number, value: string | number) => {
    updateRequests.push({
      range: `${quoteTab(CREATORS_TAB)}!${colLetter(col)}${row}`,
      values: [[value]],
    })
  }

  // 2) For every active creator with a handle, either patch the
  // tracked cells in their row or compose a brand-new row to append.
  for (const c of creators) {
    if (!c.tiktok_handle) continue
    const key = normalizeHandle(c.tiktok_handle)
    const buckets = byCreator.get(c.id) ?? { acc: [0, 0, 0, 0], ttd: [0, 0, 0, 0] }
    const totalPostsThisCreator =
      buckets.acc.reduce((s, n) => s + n, 0) + buckets.ttd.reduce((s, n) => s + n, 0)
    const gmvTotalThisCreator = Number(c.gmv_this_month ?? 0)

    const existingRow = handleToRow.get(key)
    if (existingRow != null) {
      // ACC + TTD recomputed for ALL 4 weeks (idempotent — a late
      // validation lands in its true week column on the next sync).
      for (let w = 0; w < 4; w++) {
        pushCell(existingRow, CREATORS_COL.accS[w], buckets.acc[w])
        pushCell(existingRow, CREATORS_COL.ttdS[w], buckets.ttd[w])
      }
      // GMV is per-month — stamp the running total into the current
      // week's GMV cell only. Past weeks keep their historic snapshot.
      pushCell(existingRow, CREATORS_COL.gmvS[currentWeek - 1], gmvTotalThisCreator)
      pushCell(existingRow, CREATORS_COL.totalPosts, totalPostsThisCreator)
      pushCell(existingRow, CREATORS_COL.totalGmv, gmvTotalThisCreator)
      updated++
      continue
    }

    // New row — fill what we know, leave admin-maintained columns
    // (Nicho, ACC/TTD mes ant., Fidelidad %) blank. Length matches
    // the schema (22 columns A..V).
    const row = new Array<string | number>(22).fill('')
    row[CREATORS_COL.nombre] = c.full_name ?? ''
    row[CREATORS_COL.handle] = c.tiktok_handle ?? ''
    row[CREATORS_COL.tier] = c.nivel
    if (c.created_at) row[CREATORS_COL.fechaLinkeo] = c.created_at.slice(0, 10)
    for (let w = 0; w < 4; w++) {
      row[CREATORS_COL.accS[w]] = buckets.acc[w]
      row[CREATORS_COL.ttdS[w]] = buckets.ttd[w]
    }
    row[CREATORS_COL.gmvS[currentWeek - 1]] = gmvTotalThisCreator
    row[CREATORS_COL.totalPosts] = totalPostsThisCreator
    row[CREATORS_COL.totalGmv] = gmvTotalThisCreator
    appendRows.push(row)
    appended++
  }

  // 3) Team totals at fixed sheet rows. Cols B..E (TEAM_TOTALS_COLS)
  // for the S1..S4 metrics; for per-month metrics (GMV semana, GMV>0)
  // we stamp the current week's column only.
  const teamTotalsUpdated: string[] = []
  const writeTeamRow = (label: string, sheetRow: number, perWeek: readonly number[]) => {
    for (let w = 0; w < 4; w++) {
      pushCell(sheetRow, TEAM_TOTALS_COLS[w], perWeek[w])
    }
    teamTotalsUpdated.push(label)
  }
  const writeTeamCurrentWeekCell = (label: string, sheetRow: number, value: number) => {
    pushCell(sheetRow, TEAM_TOTALS_COLS[currentWeek - 1], value)
    teamTotalsUpdated.push(label)
  }
  writeTeamRow('Nuevas Incorporadas', TEAM_TOTALS_ROW.nuevas, totals.newCreatorsByWeek)
  writeTeamRow('ACC Posts (semana)', TEAM_TOTALS_ROW.accPosts, totals.accByWeek)
  writeTeamRow('TTD Posts (semana)', TEAM_TOTALS_ROW.ttdPosts, totals.ttdByWeek)
  writeTeamCurrentWeekCell('GMV Semana', TEAM_TOTALS_ROW.gmvSemana, totals.gmvThisMonthSum)
  writeTeamRow('Creadoras Activas', TEAM_TOTALS_ROW.activas, totals.activeCreatorsByWeek)
  writeTeamCurrentWeekCell('Creadoras con GMV>0', TEAM_TOTALS_ROW.conGmv, totals.creatorsWithGmvCount)

  // 4) Flush — batch update first, then append. Append inserts
  // after the last filled row in the data range so it doesn't
  // collide with the team-totals section above.
  await safeBatchUpdate(sheets, CREATORS_TAB, updateRequests)
  if (appendRows.length > 0) {
    const appendStart = lastDataRow + 1
    const appendRange = `${quoteTab(CREATORS_TAB)}!A${appendStart}:V${appendStart + appendRows.length - 1}`
    await safeBatchUpdate(sheets, CREATORS_TAB, [
      { range: appendRange, values: appendRows },
    ])
  }

  return { updated, appended, total: updated + appended, teamTotalsUpdated }
}

// ── DASHBOARD MAYO tab ─────────────────────────────────────

async function syncToDashboardTab(
  sheets: sheets_v4.Sheets,
  creators: CreatorRow[],
  byCreator: Map<string, { acc: number[]; ttd: number[] }>,
  currentWeek: 1 | 2 | 3 | 4,
  monthStartIsoStr: string,
  monthEndIsoStr: string,
): Promise<{ updatedLabels: string[] }> {
  const range = `${quoteTab(DASHBOARD_TAB)}!A1:AZ100`
  const allRows = await safeGet(sheets, DASHBOARD_TAB, range)
  if (allRows.length === 0) return { updatedLabels: [] }

  // Look for a row containing S1..S4 headers so we know which columns
  // map to which week. Scan the first 20 rows for tolerance.
  const headerRowIndex = allRows
    .slice(0, 20)
    .findIndex((row) =>
      row.some((c) => normHeader(c) === 's1') &&
      row.some((c) => normHeader(c) === 's2'),
    )
  let weekCols: number[] | null = null
  if (headerRowIndex >= 0) {
    const r = allRows[headerRowIndex]
    weekCols = [
      r.findIndex((c) => normHeader(c) === 's1'),
      r.findIndex((c) => normHeader(c) === 's2'),
      r.findIndex((c) => normHeader(c) === 's3'),
      r.findIndex((c) => normHeader(c) === 's4'),
    ]
    if (weekCols.some((c) => c < 0)) weekCols = null
  }

  // Per-week totals across all non-internal creators.
  const accTotalsByWeek = [0, 0, 0, 0]
  const ttdTotalsByWeek = [0, 0, 0, 0]
  byCreator.forEach((buckets) => {
    for (let w = 0; w < 4; w++) {
      accTotalsByWeek[w] += buckets.acc[w]
      ttdTotalsByWeek[w] += buckets.ttd[w]
    }
  })
  const gmvMonthTotal = creators.reduce((s, c) => s + Number(c.gmv_this_month ?? 0), 0)
  const newCreatorsCount = creators.filter(
    (c) => c.approved_at && c.approved_at >= monthStartIsoStr && c.approved_at <= monthEndIsoStr,
  ).length

  const updates: sheets_v4.Schema$ValueRange[] = []
  const updatedLabels: string[] = []

  // Helper: update the S1..S4 cells on a labeled row.
  const updateWeekly = (label: string, values: number[]) => {
    const idx = findRow(allRows, label)
    if (idx < 0) return
    if (!weekCols) {
      // Fallback: columns B/C/D/E (1..4).
      weekCols = [1, 2, 3, 4]
    }
    for (let w = 0; w < 4; w++) {
      const col = weekCols[w]
      if (col < 0) continue
      const a1 = `${quoteTab(DASHBOARD_TAB)}!${colLetter(col)}${idx + 1}`
      updates.push({ range: a1, values: [[values[w]]] })
    }
    updatedLabels.push(label)
  }

  updateWeekly('ACC Posts', accTotalsByWeek)
  updateWeekly('TTD Posts', ttdTotalsByWeek)

  // GMV Total → write the running month total into the current week's
  // column. Same pattern as the per-creator GMV stamp.
  const idxGmv = findRow(allRows, 'GMV Total')
  if (idxGmv >= 0) {
    const col = weekCols ? weekCols[currentWeek - 1] : currentWeek // fallback B/C/D/E
    if (col >= 0) {
      updates.push({
        range: `${quoteTab(DASHBOARD_TAB)}!${colLetter(col)}${idxGmv + 1}`,
        values: [[gmvMonthTotal]],
      })
      updatedLabels.push('GMV Total')
    }
  }

  // Nuevas Criadoras → single cell, current week's column.
  const idxNew = findRow(allRows, 'Nuevas Criadoras')
  if (idxNew >= 0) {
    const col = weekCols ? weekCols[currentWeek - 1] : currentWeek
    if (col >= 0) {
      updates.push({
        range: `${quoteTab(DASHBOARD_TAB)}!${colLetter(col)}${idxNew + 1}`,
        values: [[newCreatorsCount]],
      })
      updatedLabels.push('Nuevas Criadoras')
    }
  }

  await safeBatchUpdate(sheets, DASHBOARD_TAB, updates)
  return { updatedLabels }
}

function normalizeHandle(raw: unknown): string {
  return String(raw ?? '').trim().toLowerCase().replace(/^@/, '')
}

// ── CONTENT tab ────────────────────────────────────────────

/**
 * "CONTENT" tab — three labeled rows ("ACC Posts", "TTD Posts",
 * "Total Videos") updated per week. Same S1..S4 column-discovery
 * pattern as the DASHBOARD MAYO tab.
 */
async function syncToContentTab(
  sheets: sheets_v4.Sheets,
  accByWeek: [number, number, number, number],
  ttdByWeek: [number, number, number, number],
): Promise<{ updatedLabels: string[] }> {
  const range = `${quoteTab(CONTENT_TAB)}!A1:AZ100`
  const allRows = await safeGet(sheets, CONTENT_TAB, range)
  if (allRows.length === 0) return { updatedLabels: [] }

  const weekCols = findWeekColumns(allRows) ?? [1, 2, 3, 4]
  const updates: sheets_v4.Schema$ValueRange[] = []
  const updatedLabels: string[] = []

  const totalsByWeek: [number, number, number, number] = [
    accByWeek[0] + ttdByWeek[0],
    accByWeek[1] + ttdByWeek[1],
    accByWeek[2] + ttdByWeek[2],
    accByWeek[3] + ttdByWeek[3],
  ]

  const writeWeekly = (label: string, values: number[]) => {
    const idx = findRow(allRows, label)
    if (idx < 0) return
    for (let w = 0; w < 4; w++) {
      const col = weekCols[w]
      if (col < 0) continue
      updates.push({
        range: `${quoteTab(CONTENT_TAB)}!${colLetter(col)}${idx + 1}`,
        values: [[values[w]]],
      })
    }
    updatedLabels.push(label)
  }

  writeWeekly('ACC Posts', accByWeek)
  writeWeekly('TTD Posts', ttdByWeek)
  writeWeekly('Total Videos', totalsByWeek)

  await safeBatchUpdate(sheets, CONTENT_TAB, updates)
  return { updatedLabels }
}

/**
 * Look for a row containing the literal headers "S1", "S2", ...
 * within the first 20 rows. Returns the 4 column indices (or null
 * if not all four are found — caller falls back to B/C/D/E).
 */
function findWeekColumns(allRows: string[][]): [number, number, number, number] | null {
  const headerRowIndex = allRows
    .slice(0, 20)
    .findIndex(
      (row) =>
        row.some((c) => normHeader(c) === 's1') &&
        row.some((c) => normHeader(c) === 's2'),
    )
  if (headerRowIndex < 0) return null
  const r = allRows[headerRowIndex]
  const cols: [number, number, number, number] = [
    r.findIndex((c) => normHeader(c) === 's1'),
    r.findIndex((c) => normHeader(c) === 's2'),
    r.findIndex((c) => normHeader(c) === 's3'),
    r.findIndex((c) => normHeader(c) === 's4'),
  ]
  if (cols.some((c) => c < 0)) return null
  return cols
}

// ── DASHBOARD ANUAL tab ────────────────────────────────────

/**
 * Annual dashboard — one column per month (Jan→Dec). We resolve the
 * current month's column by:
 *
 *   1. Scanning the first 20 rows for a header cell matching the
 *      Spanish month name (case-insensitive, accents-folded).
 *   2. Falling back to colLetter(currentMonth) — i.e. column B for
 *      January, C for February, …, F for May, …, M for December.
 *      (Column A is the label column; B..M are months 1..12.)
 *
 * Then we update the cells at the intersection of the month column
 * and these labeled rows:
 *
 *   "Nuevas Criadoras Incorporadas" → newCreatorsThisMonth
 *   "Total Criadoras Activas"        → activeCreatorsCount
 *   "ACC Posts"                       → accThisMonth
 *   "TTD Posts"                       → ttdThisMonth
 *   "GMV Total ($)"                   → gmvThisMonthSum
 */
async function syncToDashboardAnualTab(
  sheets: sheets_v4.Sheets,
  now: Date,
  data: {
    nuevasCriadoras: number
    totalActivas: number
    accPosts: number
    ttdPosts: number
    gmvTotal: number
  },
): Promise<{ updatedLabels: string[]; monthColumn: string | null }> {
  const range = `${quoteTab(DASHBOARD_ANUAL_TAB)}!A1:AZ200`
  const allRows = await safeGet(sheets, DASHBOARD_ANUAL_TAB, range)
  if (allRows.length === 0) return { updatedLabels: [], monthColumn: null }

  const monthIdx0 = now.getUTCMonth() // 0..11
  const monthName = SPANISH_MONTHS[monthIdx0]

  // 1) Try to find the column whose header (within first 20 rows)
  // contains the Spanish month name.
  let monthCol = -1
  for (let r = 0; r < Math.min(20, allRows.length); r++) {
    const row = allRows[r] ?? []
    for (let c = 0; c < row.length; c++) {
      const cell = normHeader(row[c])
      if (cell === monthName || cell.startsWith(monthName + ' ')) {
        monthCol = c
        break
      }
    }
    if (monthCol >= 0) break
  }

  // 2) Fallback to the conventional column layout (A=label, B=Jan,
  // …, M=Dec). For May (monthIdx0=4) this gives column F.
  if (monthCol < 0) monthCol = monthIdx0 + 1

  const updates: sheets_v4.Schema$ValueRange[] = []
  const updatedLabels: string[] = []

  const writeCell = (label: string, value: number) => {
    const idx = findRow(allRows, label)
    if (idx < 0) return
    updates.push({
      range: `${quoteTab(DASHBOARD_ANUAL_TAB)}!${colLetter(monthCol)}${idx + 1}`,
      values: [[value]],
    })
    updatedLabels.push(label)
  }

  writeCell('Nuevas Criadoras Incorporadas', data.nuevasCriadoras)
  writeCell('Total Criadoras Activas', data.totalActivas)
  writeCell('ACC Posts', data.accPosts)
  writeCell('TTD Posts', data.ttdPosts)
  writeCell('GMV Total ($)', data.gmvTotal)

  await safeBatchUpdate(sheets, DASHBOARD_ANUAL_TAB, updates)
  return { updatedLabels, monthColumn: colLetter(monthCol) }
}
