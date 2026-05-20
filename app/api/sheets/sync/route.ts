import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncSheets } from '@/lib/sheets-sync'

export const dynamic = 'force-dynamic'
// googleapis pulls in node-only modules (fs, util, etc.) so we have
// to force Node — the default Edge runtime would 500.
export const runtime = 'nodejs'

/**
 * Manual sheets-sync triggered from the admin panel. Guarded by the
 * same `go_admin_session=valid` cookie as the rest of the admin
 * surface. The cron uses the parallel /api/cron/weekly-sheets-sync
 * route with a Bearer secret instead.
 */
export async function POST() {
  const cookieStore = await cookies()
  const session = cookieStore.get('go_admin_session')
  if (session?.value !== 'valid') {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  try {
    const summary = await syncSheets(admin)
    console.log('[sheets-sync:manual]', JSON.stringify(summary))
    return NextResponse.json({ ok: true, ...summary })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[sheets-sync:manual] failed:', msg)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
