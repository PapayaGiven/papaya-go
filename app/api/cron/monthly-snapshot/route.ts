import { NextRequest, NextResponse } from 'next/server'
import { takeMonthlySnapshot } from '@/app/admin/actions'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  // Vercel cron sends Authorization: Bearer <CRON_SECRET>
  const auth = req.headers.get('authorization')
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Step 1: take the snapshot of the previous month BEFORE we reset, so the
  // numbers are still in go_creators when we read them.
  const result = await takeMonthlySnapshot()
  if (result.error) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 })
  }

  // Step 2: reset all creators' monthly counters. Live ACC/TTD reads filter
  // by created_at this month so they reset automatically; this update keeps
  // the denormalized fields (used by leaderboard sort, hero chip) in sync.
  const supabase = createAdminClient()
  const { error: resetError } = await supabase
    .from('go_creators')
    .update({ gmv_this_month: 0, acc_this_month: 0, ttd_this_month: 0, videos_this_month: 0 })
    .neq('id', '00000000-0000-0000-0000-000000000000')
  if (resetError) {
    return NextResponse.json({ ok: false, snapshot: result, resetError: resetError.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    snapshot: { month: result.month, year: result.year },
    reset: 'all creators',
    takenAt: new Date().toISOString(),
  })
}
