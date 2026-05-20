import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncSheets } from '@/lib/sheets-sync'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Weekly sheets sync — Mondays at 09:00 UTC via Vercel cron. Same
 * sync logic as the manual /api/sheets/sync route, but authenticated
 * by Bearer CRON_SECRET (matches the monthly snapshot cron pattern).
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

  const admin = createAdminClient()
  try {
    const summary = await syncSheets(admin)
    console.log('[sheets-sync:cron]', JSON.stringify(summary))
    return NextResponse.json({ ok: true, ...summary })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[sheets-sync:cron] failed:', msg)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
