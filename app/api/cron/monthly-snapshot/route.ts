import { NextRequest, NextResponse } from 'next/server'
import { takeMonthlySnapshot } from '@/app/admin/actions'

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

  const result = await takeMonthlySnapshot()
  if (result.error) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 })
  }
  return NextResponse.json({ ok: true, month: result.month, year: result.year, takenAt: new Date().toISOString() })
}
