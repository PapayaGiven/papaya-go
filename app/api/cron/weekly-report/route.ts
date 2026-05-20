import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeWeeklyReport, formatReportAsCsv } from '@/lib/weekly-report'
import { writeWeeklyReportToSheet } from '@/lib/google-sheets'

export const dynamic = 'force-dynamic'

/**
 * Weekly manager report — runs every Monday at 8am UTC (Vercel cron).
 *
 * Pulls the last completed week (Mon–Sun) and pushes it to the
 * Google Sheet configured by the admin in go_settings (key
 * 'weekly_report_sheet_id'). If no sheet ID is set we log a warning
 * and return ok — this lets the admin defer Sheets setup without
 * the cron starting to error.
 *
 * Auth: same Bearer CRON_SECRET pattern as the monthly snapshot cron.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // Look up the configured sheet ID. Empty/missing = log + skip.
  const { data: setting, error: settingErr } = await supabase
    .from('go_settings')
    .select('value')
    .eq('key', 'weekly_report_sheet_id')
    .maybeSingle()
  if (settingErr) {
    console.error('[weekly-report] settings lookup:', settingErr.message)
    return NextResponse.json({ ok: false, error: settingErr.message }, { status: 500 })
  }
  const sheetId = setting?.value ?? null

  let report
  try {
    report = await computeWeeklyReport(supabase)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[weekly-report] compute:', msg)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }

  console.log(
    `[weekly-report] ${report.weekLabel} — acc=${report.totalAcc} ttd=${report.totalTtd} ` +
    `new=${report.newCreators} level_ups=${report.levelUps} creators=${report.perCreator.length}`,
  )

  if (!sheetId) {
    console.warn('[weekly-report] no weekly_report_sheet_id configured — skipping Sheets write. Report computed but not exported.')
    // Echo the report (truncated) in the response so tail-the-cron
    // operators can confirm it would have worked.
    return NextResponse.json({
      ok: true,
      skipped: 'no_sheet_id_configured',
      week_label: report.weekLabel,
      totals: { acc: report.totalAcc, ttd: report.totalTtd, total: report.totalVideos },
      new_creators: report.newCreators,
      level_ups: report.levelUps,
      csv_preview: formatReportAsCsv(report).split('\n').slice(0, 10).join('\n'),
    })
  }

  try {
    await writeWeeklyReportToSheet(sheetId, report)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[weekly-report] sheets write:', msg)
    return NextResponse.json({ ok: false, error: msg, week_label: report.weekLabel }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    week_label: report.weekLabel,
    sheet_url: `https://docs.google.com/spreadsheets/d/${sheetId}/edit`,
    totals: { acc: report.totalAcc, ttd: report.totalTtd, total: report.totalVideos },
    new_creators: report.newCreators,
    level_ups: report.levelUps,
  })
}
