import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMonthlyVideoStats, getMonthBounds } from '@/lib/videoStats'

export const dynamic = 'force-dynamic'

// Stats for a single month, used by the admin Crecimiento month selector.
// Prefers a saved snapshot; falls back to live aggregation from the source
// tables. Admin-only (same go_admin_session cookie as /admin).
export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  if (cookieStore.get('go_admin_session')?.value !== 'valid') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const month = parseInt(searchParams.get('month') ?? '', 10)
  const year = parseInt(searchParams.get('year') ?? '', 10)
  if (!month || month < 1 || month > 12 || !year) {
    return NextResponse.json({ error: 'Parámetros month/year inválidos' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // 1. Prefer a saved snapshot for this month/year. The snapshot tables are
  // optional infra — if they don't exist yet (migration not applied) or the
  // read fails, DON'T 500: fall through to live aggregation so the month
  // selector still works. Saving snapshots requires the tables; reading is
  // best-effort.
  const { data: snap, error: snapErr } = await supabase
    .from('go_monthly_snapshots')
    .select('*')
    .eq('month', month)
    .eq('year', year)
    .maybeSingle()
  if (snapErr) {
    console.warn('[monthly-stats] snapshot read failed, using live data:', snapErr.message)
  }

  if (snap) {
    return NextResponse.json({
      month,
      year,
      // total_*_videos = regular (is_valid) counts; internal_* stored
      // separately. The card wants the combined total, matching the live
      // path below (getMonthlyVideoStats.total*Approved).
      acc: (snap.total_acc_videos ?? 0) + (snap.internal_acc_videos ?? 0),
      ttd: (snap.total_ttd_videos ?? 0) + (snap.internal_ttd_videos ?? 0),
      gmv: Number(snap.total_gmv ?? 0),
      newCreators: snap.new_creators ?? 0,
      totalCreators: snap.total_creators ?? 0,
      fromSnapshot: true,
      snapshotDate: snap.snapshot_taken_at,
    })
  }

  // 2. No snapshot — calculate live from go_boost_requests + go_internal_videos.
  const stats = await getMonthlyVideoStats(supabase, month, year)
  const { startOfMonth, endOfMonth } = getMonthBounds(month, year)

  const [activeRes, newCreatorsRes] = await Promise.all([
    supabase.from('go_creators').select('gmv_this_month').eq('status', 'active'),
    supabase
      .from('go_creators')
      .select('id', { count: 'exact', head: true })
      .gte('approved_at', startOfMonth)
      .lte('approved_at', endOfMonth),
  ])
  if (activeRes.error) return NextResponse.json({ error: activeRes.error.message }, { status: 500 })

  const activeCreators = activeRes.data ?? []
  // GMV is only accurate for the current month (gmv_this_month is a live
  // counter). For a past month with no snapshot there's no historical GMV
  // source, so this is best-effort — admin should save a snapshot to lock it.
  const gmv = activeCreators.reduce((s, c) => s + Number(c.gmv_this_month ?? 0), 0)

  return NextResponse.json({
    month,
    year,
    acc: stats.totalAccApproved,
    ttd: stats.totalTtdApproved,
    gmv,
    newCreators: newCreatorsRes.count ?? 0,
    totalCreators: activeCreators.length,
    fromSnapshot: false,
    snapshotDate: null,
  })
}
