'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { addCreatorCounters, checkAndApplyLevelUps } from '@/lib/creatorCounters'
import { revalidatePath } from 'next/cache'
import { normalizeTiktokUrl } from '@/lib/normalizeUrl'

export type BatchRowResult = { duplicate?: boolean; error?: string }

// Multi-link submission. Each row is validated + duplicate-checked independently,
// then every non-duplicate row is inserted in a SINGLE batch insert. The returned
// `results` array is index-aligned with the input `rows` so the client can paint
// a per-row error ("⚠️ Link duplicado") without losing which row failed.
//
// Internal videos are auto-approved: inserted as 'approved' and counted toward
// the creator's monthly counters + level-up right away. Admin can still reject
// from the Videos Internos tab, which reverses the counters.
export async function submitInternalVideosBatch(
  creator_id: string,
  rows: { tiktok_url: string; video_type: 'ACC' | 'TTD'; tiktok_account_id: string | null }[]
): Promise<{ results: BatchRowResult[]; insertedCount: number }> {
  // Counters are written with the service role, so the creator_id from the
  // client must belong to the signed-in internal creator.
  const results: BatchRowResult[] = rows.map(() => ({}))
  const authClient = await createClient()
  const { data: { user } } = await authClient.auth.getUser()
  const { data: me } = user?.email
    ? await authClient.from('go_creators').select('id, is_internal').eq('email', user.email).maybeSingle()
    : { data: null }
  if (!me || me.id !== creator_id || !me.is_internal) {
    return { results: results.map(() => ({ error: 'No autorizado' })), insertedCount: 0 }
  }

  const supabase = createAdminClient()

  // One read of the creator's existing links; compared on the NORMALIZED form so
  // legacy pre-normalization rows are still caught (same logic as the single insert).
  const { data: existing } = await supabase
    .from('go_internal_videos')
    .select('tiktok_url')
    .eq('creator_id', creator_id)
  const existingNorm = new Set(
    (existing ?? []).map((r) => normalizeTiktokUrl(r.tiktok_url))
  )

  const seenInBatch = new Set<string>()
  const toInsert: { index: number; row: (typeof rows)[number]; norm: string }[] = []

  rows.forEach((row, i) => {
    const norm = normalizeTiktokUrl(row.tiktok_url)
    if (!norm) {
      results[i] = { error: 'Pega el link de tu video' }
      return
    }
    if (row.video_type !== 'ACC' && row.video_type !== 'TTD') {
      results[i] = { error: 'Selecciona ACC o TTD' }
      return
    }
    // Duplicate against the DB OR against an earlier row in this same batch.
    if (existingNorm.has(norm) || seenInBatch.has(norm)) {
      results[i] = { duplicate: true, error: '⚠️ Link duplicado' }
      return
    }
    seenInBatch.add(norm)
    toInsert.push({ index: i, row, norm })
  })

  let insertedCount = 0
  if (toInsert.length > 0) {
    const nowIso = new Date().toISOString()
    const { error } = await supabase.from('go_internal_videos').insert(
      toInsert.map(({ row, norm }) => ({
        creator_id,
        tiktok_account_id: row.tiktok_account_id,
        tiktok_url: norm,
        video_type: row.video_type,
        status: 'approved',
        submitted_at: nowIso,
        approved_at: nowIso,
      }))
    )
    if (error) {
      // UNIQUE (creator_id, tiktok_url) — a race with a concurrent submit. We
      // can't tell which row collided, so flag every attempted row as duplicate.
      const rowResult: BatchRowResult =
        error.code === '23505'
          ? { duplicate: true, error: '⚠️ Link duplicado' }
          : { error: error.message }
      toInsert.forEach(({ index }) => {
        results[index] = rowResult
      })
    } else {
      insertedCount = toInsert.length
      await addCreatorCounters(supabase, creator_id, {
        acc: toInsert.filter(({ row }) => row.video_type === 'ACC').length,
        ttd: toInsert.filter(({ row }) => row.video_type === 'TTD').length,
      })
      await checkAndApplyLevelUps(creator_id)
    }
  }

  revalidatePath('/internal-dashboard')
  revalidatePath('/admin')
  revalidatePath('/dashboard')
  return { results, insertedCount }
}
