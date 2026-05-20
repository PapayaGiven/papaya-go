import { google, type sheets_v4 } from 'googleapis'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Hard-coded sheet ID (the "master" weekly tracking sheet shared with
 * the service account). Allow override via env so we can point at a
 * staging sheet during local development without code changes.
 */
const MASTER_SHEET_ID = process.env.PAPAYA_GO_SHEET_ID ?? '1a_WJ5LYw21JwN61K2z1VkJrVvpxvfVCH'
const CREATORS_TAB = 'CREATORS'
const DASHBOARD_TAB = 'DASHBOARD MAYO'
const DASHBOARD_ANUAL_TAB = 'DASHBOARD ANUAL'
const CONTENT_TAB = 'CONTENT'

const SPANISH_MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

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

function findColumn(header: string[], wanted: string): number {
  const target = normHeader(wanted)
  return header.findIndex((h) => normHeader(h) === target)
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

export async function syncSheets(admin: SupabaseClient): Promise<SyncSummary> {
  const sheets = await getSheetsClient()
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

  const creatorsTabSummary = await syncToCreatorsTab(
    sheets,
    creators,
    byCreator,
    currentWeek,
    activeCreatorsByWeek,
    creatorsWithGmvCount,
  )
  const dashboardTabSummary = await syncToDashboardTab(sheets, creators, byCreator, currentWeek, startIso, endIso)
  const contentTabSummary = await syncToContentTab(sheets, accByWeek, ttdByWeek)
  const dashboardAnualTabSummary = await syncToDashboardAnualTab(sheets, now, {
    nuevasCriadoras: newCreatorsThisMonth,
    totalActivas: activeCreatorsCount,
    accPosts: accThisMonth,
    ttdPosts: ttdThisMonth,
    gmvTotal: gmvThisMonthSum,
  })

  return {
    syncedAt: now.toISOString(),
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

async function syncToCreatorsTab(
  sheets: sheets_v4.Sheets,
  creators: CreatorRow[],
  byCreator: Map<string, { acc: number[]; ttd: number[] }>,
  currentWeek: 1 | 2 | 3 | 4,
  activeCreatorsByWeek: [number, number, number, number],
  creatorsWithGmvCount: number,
): Promise<{ updated: number; appended: number; total: number; teamTotalsUpdated: string[] }> {
  // Pull header row + a wide enough body to cover most realistic
  // sheet sizes. Empty trailing rows are returned as undefined which
  // we coerce to "" — Google trims trailing blanks in the response.
  const range = `${quoteTab(CREATORS_TAB)}!A1:AZ5000`
  const read = await sheets.spreadsheets.values.get({
    spreadsheetId: MASTER_SHEET_ID,
    range,
  })
  const allRows = (read.data.values ?? []) as string[][]
  if (allRows.length === 0) {
    throw new Error(`Tab "${CREATORS_TAB}" está vacío o no existe.`)
  }
  const header = allRows[0].map((h) => String(h ?? ''))

  // Resolve the columns we need. If any is missing we still try the
  // ones we have — the response includes a `missing` field the route
  // logs for diagnosis.
  const cols = {
    handle: findColumn(header, '@Handle'),
    name: findColumn(header, 'Nombre'),
    nivel: findColumn(header, 'Tier'),
    fechaLinkeo: findColumn(header, 'Fecha Linkeo'),
    accS1: findColumn(header, 'ACC S1'),
    ttdS1: findColumn(header, 'TTD S1'),
    gmvS1: findColumn(header, 'GMV S1'),
    accS2: findColumn(header, 'ACC S2'),
    ttdS2: findColumn(header, 'TTD S2'),
    gmvS2: findColumn(header, 'GMV S2'),
    accS3: findColumn(header, 'ACC S3'),
    ttdS3: findColumn(header, 'TTD S3'),
    gmvS3: findColumn(header, 'GMV S3'),
    accS4: findColumn(header, 'ACC S4'),
    ttdS4: findColumn(header, 'TTD S4'),
    gmvS4: findColumn(header, 'GMV S4'),
    totalPosts: findColumn(header, 'Total Posts'),
    totalGmv: findColumn(header, 'Total GMV'),
  }
  if (cols.handle < 0) {
    throw new Error('Columna "@Handle" no encontrada en CREATORS — verifica el header.')
  }

  // Build a handle → rowIndex map (1-based sheet row, so data rows
  // start at 2). Normalize handles by lowercasing + stripping "@".
  const handleToRow = new Map<string, number>()
  for (let i = 1; i < allRows.length; i++) {
    const raw = allRows[i][cols.handle] ?? ''
    const key = normalizeHandle(raw)
    if (key) handleToRow.set(key, i + 1)
  }

  const accWeekCols = [cols.accS1, cols.accS2, cols.accS3, cols.accS4]
  const ttdWeekCols = [cols.ttdS1, cols.ttdS2, cols.ttdS3, cols.ttdS4]
  const gmvWeekCols = [cols.gmvS1, cols.gmvS2, cols.gmvS3, cols.gmvS4]

  const updateRequests: sheets_v4.Schema$ValueRange[] = []
  const appendRows: (string | number)[][] = []
  let updated = 0
  let appended = 0
  let nextRowForNewRows = allRows.length + 1

  for (const c of creators) {
    if (!c.tiktok_handle) continue
    const key = normalizeHandle(c.tiktok_handle)
    const buckets = byCreator.get(c.id) ?? { acc: [0, 0, 0, 0], ttd: [0, 0, 0, 0] }
    const totalPosts = buckets.acc.reduce((s, n) => s + n, 0) + buckets.ttd.reduce((s, n) => s + n, 0)
    const gmvTotal = Number(c.gmv_this_month ?? 0)

    const rowIndex = handleToRow.get(key) ?? null

    if (rowIndex == null) {
      // New creator — append at the end. We fill what we know;
      // Nicho / ACC (mes ant.) / TTD (mes ant.) / Fidelidad % are
      // left blank for the admin to fill in.
      const row = new Array<string | number>(header.length).fill('')
      if (cols.name >= 0) row[cols.name] = c.full_name ?? ''
      if (cols.handle >= 0) row[cols.handle] = c.tiktok_handle ?? ''
      if (cols.nivel >= 0) row[cols.nivel] = c.nivel
      if (cols.fechaLinkeo >= 0 && c.created_at) row[cols.fechaLinkeo] = c.created_at.slice(0, 10)
      writeWeeklyCells(row, accWeekCols, ttdWeekCols, gmvWeekCols, buckets, gmvTotal, currentWeek)
      if (cols.totalPosts >= 0) row[cols.totalPosts] = totalPosts
      if (cols.totalGmv >= 0) row[cols.totalGmv] = gmvTotal
      appendRows.push(row)
      handleToRow.set(key, nextRowForNewRows)
      nextRowForNewRows++
      appended++
      continue
    }

    // Existing creator — batch a row update. We update only the cells
    // we track (ACC/TTD/GMV per week + totals) so manually maintained
    // columns like Nicho, Tier, Fidelidad % stay intact.
    const partial = new Array<string | number | null>(header.length).fill(null)
    writeWeeklyCells(partial, accWeekCols, ttdWeekCols, gmvWeekCols, buckets, gmvTotal, currentWeek)
    if (cols.totalPosts >= 0) partial[cols.totalPosts] = totalPosts
    if (cols.totalGmv >= 0) partial[cols.totalGmv] = gmvTotal

    // Splice into ranges of contiguous non-null cells so we don't
    // overwrite the entire row (which would blank out untracked cols).
    const ranges = compactRanges(partial, rowIndex)
    updateRequests.push(...ranges)
    updated++
  }

  // ── Team totals ─────────────────────────────────────────
  //
  // Two summary rows at the bottom of the CREATORS tab:
  //
  //   "✅ Creadoras Activas"  → per-week count of creators who had
  //       at least one approved video that week. One value per
  //       S1/S2/S3/S4.
  //   "🌟 Creadoras con GMV>0" → current count of creators whose
  //       gmv_this_month > 0. Stamped only into the current week's
  //       column (the metric is per-month, not per-week — matches
  //       the GMV-stamp pattern used for the per-creator rows).
  //
  // We write into the ACC S{w} column for each week. This assumes
  // the totals rows reuse the same column layout as the per-creator
  // rows above them, which is the common case for these "totals at
  // the bottom of a creator-keyed table" sheets. If the admin's
  // sheet actually uses GMV S{w} or TTD S{w} for the totals, the
  // value still lands at the right horizontal position — they can
  // move the cell display to whichever column they prefer.
  const teamTotalsUpdated: string[] = []
  const writeTeamTotalsCell = (rowIdx1Based: number, col: number, value: number) => {
    if (col < 0) return
    updateRequests.push({
      range: `${quoteTab(CREATORS_TAB)}!${colLetter(col)}${rowIdx1Based}`,
      values: [[value]],
    })
  }
  const activasIdx = findRow(allRows, '✅ Creadoras Activas')
  if (activasIdx >= 0) {
    for (let w = 0; w < 4; w++) {
      writeTeamTotalsCell(activasIdx + 1, accWeekCols[w], activeCreatorsByWeek[w])
    }
    teamTotalsUpdated.push('✅ Creadoras Activas')
  }
  const conGmvIdx = findRow(allRows, '🌟 Creadoras con GMV>0')
  if (conGmvIdx >= 0) {
    writeTeamTotalsCell(conGmvIdx + 1, accWeekCols[currentWeek - 1], creatorsWithGmvCount)
    teamTotalsUpdated.push('🌟 Creadoras con GMV>0')
  }

  if (updateRequests.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: MASTER_SHEET_ID,
      requestBody: {
        valueInputOption: 'RAW',
        data: updateRequests,
      },
    })
  }
  if (appendRows.length > 0) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: MASTER_SHEET_ID,
      range: `${quoteTab(CREATORS_TAB)}!A:A`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: appendRows },
    })
  }

  return { updated, appended, total: updated + appended, teamTotalsUpdated }
}

function writeWeeklyCells(
  row: (string | number | null)[],
  accCols: number[],
  ttdCols: number[],
  gmvCols: number[],
  buckets: { acc: number[]; ttd: number[] },
  gmvTotal: number,
  currentWeek: 1 | 2 | 3 | 4,
): void {
  // ACC and TTD recomputed for ALL 4 weeks (idempotent — late
  // validations show up retroactively).
  for (let w = 0; w < 4; w++) {
    if (accCols[w] >= 0) row[accCols[w]] = buckets.acc[w]
    if (ttdCols[w] >= 0) row[ttdCols[w]] = buckets.ttd[w]
  }
  // GMV is per-month, not per-week — stamp the running total into
  // the current week's column only.
  const gmvCol = gmvCols[currentWeek - 1]
  if (gmvCol >= 0) row[gmvCol] = gmvTotal
}

/**
 * Convert a sparse row (with nulls for "don't touch") into the
 * smallest set of contiguous ValueRanges. This keeps the batchUpdate
 * payload tight and never writes to columns we didn't intend to.
 */
function compactRanges(partial: (string | number | null)[], rowIndex1Based: number): sheets_v4.Schema$ValueRange[] {
  const out: sheets_v4.Schema$ValueRange[] = []
  let i = 0
  while (i < partial.length) {
    if (partial[i] === null) { i++; continue }
    const start = i
    const values: (string | number)[] = []
    while (i < partial.length && partial[i] !== null) {
      values.push(partial[i] as string | number)
      i++
    }
    const end = start + values.length - 1
    const a1 = `${quoteTab(CREATORS_TAB)}!${colLetter(start)}${rowIndex1Based}:${colLetter(end)}${rowIndex1Based}`
    out.push({ range: a1, values: [values] })
  }
  return out
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
  let read
  try {
    read = await sheets.spreadsheets.values.get({ spreadsheetId: MASTER_SHEET_ID, range })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    // The tab name is month-specific (e.g. DASHBOARD MAYO) and may
    // not exist for every month — skip rather than fail the whole
    // sync since the CREATORS tab is the authoritative one.
    console.warn(`[sheets-sync] DASHBOARD tab read failed (skipping): ${msg}`)
    return { updatedLabels: [] }
  }
  const allRows = (read.data.values ?? []) as string[][]
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

  if (updates.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: MASTER_SHEET_ID,
      requestBody: { valueInputOption: 'RAW', data: updates },
    })
  }
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
  let read
  try {
    read = await sheets.spreadsheets.values.get({ spreadsheetId: MASTER_SHEET_ID, range })
  } catch (e) {
    console.warn(`[sheets-sync] CONTENT tab read failed (skipping): ${e instanceof Error ? e.message : String(e)}`)
    return { updatedLabels: [] }
  }
  const allRows = (read.data.values ?? []) as string[][]
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

  if (updates.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: MASTER_SHEET_ID,
      requestBody: { valueInputOption: 'RAW', data: updates },
    })
  }
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
  let read
  try {
    read = await sheets.spreadsheets.values.get({ spreadsheetId: MASTER_SHEET_ID, range })
  } catch (e) {
    console.warn(`[sheets-sync] DASHBOARD ANUAL tab read failed (skipping): ${e instanceof Error ? e.message : String(e)}`)
    return { updatedLabels: [], monthColumn: null }
  }
  const allRows = (read.data.values ?? []) as string[][]
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

  if (updates.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: MASTER_SHEET_ID,
      requestBody: { valueInputOption: 'RAW', data: updates },
    })
  }
  return { updatedLabels, monthColumn: colLetter(monthCol) }
}
