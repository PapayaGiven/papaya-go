import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Diagnostic endpoint for the ACC/TTD counter bug.
//   GET /api/test-approval
// Picks the most recent boost row with is_valid IS NULL, force-marks it
// is_valid=true via the admin client, then nudges that creator's monthly
// counter. Returns the full before/after trace as JSON so we can see
// exactly where the chain breaks (env missing, RLS rejecting writes,
// counter not advancing, …).

export const dynamic = 'force-dynamic'

export async function GET() {
  const log: string[] = []
  function l(msg: string) {
    console.log(`[test-approval] ${msg}`)
    log.push(msg)
  }

  const hasUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL
  const hasServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY
  const hasAnon = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  l(`Using key type: ${hasServiceRole ? 'service role' : 'MISSING'}`)
  l(`Env present — URL=${hasUrl} SERVICE_ROLE=${hasServiceRole} ANON=${hasAnon}`)

  if (!hasUrl || !hasServiceRole) {
    return NextResponse.json({
      ok: false,
      reason: 'Missing required env vars on the server',
      env: { hasUrl, hasServiceRole, hasAnon },
      log,
    }, { status: 500 })
  }

  const supabase = createAdminClient()

  // STEP 1 — pull the most recent unreviewed boost.
  const { data: boost, error: pickErr } = await supabase
    .from('go_boost_requests')
    .select('id, creator_id, creator_name, tiktok_handle, tiktok_url, video_type, is_valid, status, boost_status, created_at')
    .is('is_valid', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (pickErr) {
    l(`pick failed: ${pickErr.message}`)
    return NextResponse.json({ ok: false, step: 'pick', error: pickErr.message, log }, { status: 500 })
  }
  if (!boost) {
    l('No boost row with is_valid IS NULL found')
    return NextResponse.json({ ok: false, reason: 'No pending boost rows', log })
  }

  l(`Picked boost id=${boost.id}`)
  l(`  creator_id  = ${boost.creator_id}`)
  l(`  creator     = ${boost.creator_name} (@${boost.tiktok_handle})`)
  l(`  video_type  = ${boost.video_type}`)
  l(`  created_at  = ${boost.created_at}`)
  l(`  is_valid    = ${boost.is_valid}`)
  l(`  status      = ${boost.status}`)
  l(`  boost_status= ${boost.boost_status}`)

  // STEP 2 — creator BEFORE.
  const { data: creatorBefore, error: cBeforeErr } = await supabase
    .from('go_creators')
    .select('id, name, nivel, acc_this_month, ttd_this_month, videos_this_month')
    .eq('id', boost.creator_id)
    .maybeSingle()
  if (cBeforeErr) l(`creator BEFORE read failed: ${cBeforeErr.message}`)
  l(`creator BEFORE: ${JSON.stringify(creatorBefore)}`)

  // STEP 3 — flip is_valid=true.
  const { error: updBoostErr, data: updBoostData } = await supabase
    .from('go_boost_requests')
    .update({ is_valid: true })
    .eq('id', boost.id)
    .select('id, is_valid')
    .maybeSingle()
  if (updBoostErr) l(`boost UPDATE failed: ${updBoostErr.message}`)
  else l(`boost UPDATE ok → ${JSON.stringify(updBoostData)}`)

  // STEP 4 — increment counter on go_creators.
  let creatorAfter: unknown = null
  if (creatorBefore && boost.video_type && (boost.video_type === 'ACC' || boost.video_type === 'TTD')) {
    const accDelta = boost.video_type === 'ACC' ? 1 : 0
    const ttdDelta = boost.video_type === 'TTD' ? 1 : 0
    const next = {
      acc_this_month: (creatorBefore.acc_this_month ?? 0) + accDelta,
      ttd_this_month: (creatorBefore.ttd_this_month ?? 0) + ttdDelta,
      videos_this_month: (creatorBefore.videos_this_month ?? 0) + 1,
    }
    l(`creator UPDATE payload: ${JSON.stringify(next)}`)
    const { error: updCErr, data: updCData } = await supabase
      .from('go_creators')
      .update(next)
      .eq('id', boost.creator_id)
      .select('id, acc_this_month, ttd_this_month, videos_this_month')
      .maybeSingle()
    if (updCErr) l(`creator UPDATE failed: ${updCErr.message}`)
    else l(`creator UPDATE ok → ${JSON.stringify(updCData)}`)
    creatorAfter = updCData ?? null

    // Sanity re-read to confirm the write actually landed.
    const { data: verify } = await supabase
      .from('go_creators')
      .select('id, acc_this_month, ttd_this_month, videos_this_month')
      .eq('id', boost.creator_id)
      .maybeSingle()
    l(`creator VERIFY re-read: ${JSON.stringify(verify)}`)
  } else {
    l(`Skipping creator UPDATE (creator missing or video_type=${boost.video_type})`)
  }

  return NextResponse.json({
    ok: true,
    env: { hasUrl, hasServiceRole, hasAnon },
    boost,
    creatorBefore,
    creatorAfter,
    log,
  })
}
