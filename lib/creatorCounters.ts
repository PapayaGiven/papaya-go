import { createAdminClient } from '@/lib/supabase/admin'

// Shared monthly-counter + level-up helpers. Plain server module (NOT
// 'use server') so these are never exposed as callable server actions —
// callers must authorize before touching another creator's counters.

export function isThisMonthIso(iso: string | null | undefined): boolean {
  if (!iso) return false
  const d = new Date(iso)
  const now = new Date()
  return d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth()
}

export async function adjustCreatorCounters(
  supabase: ReturnType<typeof createAdminClient>,
  creatorId: string,
  videoType: 'ACC' | 'TTD' | null,
  delta: 1 | -1,
) {
  const { data: c, error: readErr } = await supabase
    .from('go_creators')
    .select('acc_this_month, ttd_this_month, videos_this_month')
    .eq('id', creatorId)
    .maybeSingle()
  if (readErr) { console.log(`[adjustCreatorCounters] read failed: ${readErr.message}`); return }
  if (!c) { console.log(`[adjustCreatorCounters] no creator row for ${creatorId}`); return }
  const accDelta = videoType === 'ACC' ? delta : 0
  const ttdDelta = videoType === 'TTD' ? delta : 0
  const next = {
    acc_this_month: Math.max(0, (c.acc_this_month ?? 0) + accDelta),
    ttd_this_month: Math.max(0, (c.ttd_this_month ?? 0) + ttdDelta),
    videos_this_month: Math.max(0, (c.videos_this_month ?? 0) + delta),
  }
  console.log(`[adjustCreatorCounters] creator=${creatorId} type=${videoType} delta=${delta}`)
  console.log(`[adjustCreatorCounters] before:`, c)
  console.log(`[adjustCreatorCounters] after:`, next)
  const { error: updErr } = await supabase.from('go_creators').update(next).eq('id', creatorId)
  if (updErr) { console.log(`[adjustCreatorCounters] update failed: ${updErr.message}`); return }
  // Verification read — confirm the write actually landed.
  const { data: verify } = await supabase
    .from('go_creators')
    .select('acc_this_month, ttd_this_month, videos_this_month')
    .eq('id', creatorId)
    .maybeSingle()
  console.log(`[adjustCreatorCounters] verified:`, verify)
}

// Batch increment for multi-video submissions — one read + one write instead
// of N round-trips through adjustCreatorCounters.
export async function addCreatorCounters(
  supabase: ReturnType<typeof createAdminClient>,
  creatorId: string,
  add: { acc: number; ttd: number },
) {
  const { data: c, error: readErr } = await supabase
    .from('go_creators')
    .select('acc_this_month, ttd_this_month, videos_this_month')
    .eq('id', creatorId)
    .maybeSingle()
  if (readErr) { console.log(`[addCreatorCounters] read failed: ${readErr.message}`); return }
  if (!c) { console.log(`[addCreatorCounters] no creator row for ${creatorId}`); return }
  const next = {
    acc_this_month: (c.acc_this_month ?? 0) + add.acc,
    ttd_this_month: (c.ttd_this_month ?? 0) + add.ttd,
    videos_this_month: (c.videos_this_month ?? 0) + add.acc + add.ttd,
  }
  console.log(`[addCreatorCounters] creator=${creatorId} before=`, c, ' next=', next)
  const { error: updErr } = await supabase.from('go_creators').update(next).eq('id', creatorId)
  if (updErr) console.log(`[addCreatorCounters] update failed: ${updErr.message}`)
}

// ── Level-up engine ──────────────────────────────────────
//
// Run after any change that bumps a creator's monthly counters. Loops until
// the creator no longer qualifies for the next level (handles batch
// approvals where someone leaps multiple levels at once).
//
// On each level-up:
//   - carry_acc/ttd/total = current counter - CURRENT level's requirement
//     (so the excess past the current threshold rolls into the new level)
//   - gmv_this_month is preserved per spec — GMV doesn't reset on level up
//   - One row inserted into go_level_up_events for the audit trail / popup

interface NivelReqRow {
  nivel: number
  total_videos_required: number
  gmv_required: number
  acc_required: number
  ttd_required: number
}

export async function checkAndApplyLevelUps(creatorId: string): Promise<{ events: number }> {
  const supabase = createAdminClient()
  let events = 0

  // Fetch all requirements once; we'll iterate locally.
  const { data: reqsData } = await supabase
    .from('go_nivel_requirements')
    .select('nivel, total_videos_required, gmv_required, acc_required, ttd_required')
  const reqs = (reqsData ?? []) as NivelReqRow[]
  const reqByNivel = new Map(reqs.map(r => [r.nivel, r]))
  console.log(`[level-up] check started for creator=${creatorId}, requirements=`, Array.from(reqByNivel.values()))

  // Loop guard: cap iterations to a sane max so we never spin forever even
  // if requirements data is malformed.
  for (let i = 0; i < 8; i++) {
    const { data: c } = await supabase
      .from('go_creators')
      .select('nivel, acc_this_month, ttd_this_month, videos_this_month, gmv_this_month')
      .eq('id', creatorId)
      .maybeSingle()
    if (!c) { console.log('[level-up] no creator row, exiting'); break }
    console.log(`[level-up] iter ${i}: creator nivel=${c.nivel} acc=${c.acc_this_month} ttd=${c.ttd_this_month} total=${c.videos_this_month} gmv=${c.gmv_this_month}`)

    const next = reqByNivel.get(c.nivel + 1)
    if (!next) { console.log(`[level-up] no requirement for nivel ${c.nivel + 1}, at max`); break }
    console.log(`[level-up] next nivel ${c.nivel + 1} requires:`, next)

    const acc = c.acc_this_month ?? 0
    const ttd = c.ttd_this_month ?? 0
    const total = c.videos_this_month ?? 0
    const gmv = Number(c.gmv_this_month ?? 0)

    const qualifies =
      total >= (next.total_videos_required ?? 0)
      && gmv >= Number(next.gmv_required ?? 0)
      && acc >= (next.acc_required ?? 0)
      && ttd >= (next.ttd_required ?? 0)
    if (!qualifies) {
      console.log(`[level-up] does not qualify yet (total ${total}/${next.total_videos_required}, acc ${acc}/${next.acc_required}, ttd ${ttd}/${next.ttd_required}, gmv ${gmv}/${next.gmv_required})`)
      break
    }

    const cur = reqByNivel.get(c.nivel)
    const carryAcc = Math.max(0, acc - (cur?.acc_required ?? 0))
    const carryTtd = Math.max(0, ttd - (cur?.ttd_required ?? 0))
    const carryTotal = Math.max(0, total - (cur?.total_videos_required ?? 0))
    console.log(`[level-up] LEVELING UP ${c.nivel} -> ${c.nivel + 1}, carry acc=${carryAcc} ttd=${carryTtd} total=${carryTotal}`)

    await supabase.from('go_creators').update({
      nivel: c.nivel + 1,
      acc_this_month: carryAcc,
      ttd_this_month: carryTtd,
      videos_this_month: carryTotal,
      // gmv_this_month intentionally unchanged
    }).eq('id', creatorId)

    await supabase.from('go_level_up_events').insert({
      creator_id: creatorId,
      from_nivel: c.nivel,
      to_nivel: c.nivel + 1,
      carry_acc: carryAcc,
      carry_ttd: carryTtd,
      carry_total: carryTotal,
    })
    events++
  }

  return { events }
}

