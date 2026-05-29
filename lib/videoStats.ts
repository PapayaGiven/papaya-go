// Centralized video-count source of truth.
//
// Every "X aprobados este mes" surface — admin dashboard, per-creator
// rows, creator dashboard, boost page totals — must read from here so
// the numbers cannot drift between sections.
//
// Rules:
//   Regular videos counted  = go_boost_requests where is_valid = true
//   Regular videos pending  = go_boost_requests where is_valid IS NULL
//   Regular videos invalid  = go_boost_requests where is_valid = false
//   Internal videos counted = go_internal_videos where status = 'approved'
//   Month window            = [startOfMonth, endOfMonth] inclusive on
//                             created_at (boost requests) or submitted_at
//                             (internal videos).
//
// go_creators.acc_this_month / ttd_this_month / videos_this_month exist
// for leaderboard sorting + level-up math. NEVER use them as a display
// number — they can drift if a counter bump fails. Live counts here are
// authoritative.

import type { createAdminClient } from '@/lib/supabase/admin'

type Admin = ReturnType<typeof createAdminClient>

export function getMonthBounds(month: number, year: number): { startOfMonth: string; endOfMonth: string } {
  // month is 1-indexed (1 = January). Use local-date constructors so the
  // ISO output matches the rest of the codebase (Vercel runs in UTC).
  const startOfMonth = new Date(year, month - 1, 1).toISOString()
  const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999).toISOString()
  return { startOfMonth, endOfMonth }
}

export interface MonthlyVideoStats {
  // Regular pipeline (go_boost_requests)
  regularAccApproved: number
  regularTtdApproved: number
  regularPending: number
  regularInvalid: number
  regularSubmitted: number
  // Internal pipeline (go_internal_videos)
  internalAccApproved: number
  internalTtdApproved: number
  internalPending: number
  // Combined approved totals
  totalAccApproved: number
  totalTtdApproved: number
  totalApproved: number
}

// Whole-team aggregates for the admin dashboard. Each metric is a separate
// head-count select so we never pull row data we won't use.
export async function getMonthlyVideoStats(
  admin: Admin,
  month: number,
  year: number,
): Promise<MonthlyVideoStats> {
  const { startOfMonth, endOfMonth } = getMonthBounds(month, year)
  const head = { count: 'exact' as const, head: true }

  // TWO sources ONLY: go_boost_requests (regular creators) +
  // go_internal_videos (internal team). NEVER add
  // go_creators.acc_this_month / ttd_this_month here — those are
  // denormalized leaderboard/challenge counters, and adding them is what
  // triple-counted the dashboard rings.
  const [
    regAcc, regTtd, regPending, regInvalid, regSubmitted,
    intAcc, intTtd, intPending,
  ] = await Promise.all([
    admin.from('go_boost_requests').select('id', head)
      .eq('video_type', 'ACC').eq('is_valid', true)
      .gte('created_at', startOfMonth).lte('created_at', endOfMonth),
    admin.from('go_boost_requests').select('id', head)
      .eq('video_type', 'TTD').eq('is_valid', true)
      .gte('created_at', startOfMonth).lte('created_at', endOfMonth),
    admin.from('go_boost_requests').select('id', head)
      .is('is_valid', null)
      .gte('created_at', startOfMonth).lte('created_at', endOfMonth),
    admin.from('go_boost_requests').select('id', head)
      .eq('is_valid', false)
      .gte('created_at', startOfMonth).lte('created_at', endOfMonth),
    admin.from('go_boost_requests').select('id', head)
      .gte('created_at', startOfMonth).lte('created_at', endOfMonth),
    admin.from('go_internal_videos').select('id', head)
      .eq('video_type', 'ACC').eq('status', 'approved')
      .gte('submitted_at', startOfMonth).lte('submitted_at', endOfMonth),
    admin.from('go_internal_videos').select('id', head)
      .eq('video_type', 'TTD').eq('status', 'approved')
      .gte('submitted_at', startOfMonth).lte('submitted_at', endOfMonth),
    admin.from('go_internal_videos').select('id', head)
      .eq('status', 'pending'),
  ])

  const n = (r: { count: number | null }) => r.count ?? 0
  const regularAccApproved = n(regAcc)
  const regularTtdApproved = n(regTtd)
  const internalAccApproved = n(intAcc)
  const internalTtdApproved = n(intTtd)

  return {
    regularAccApproved,
    regularTtdApproved,
    regularPending: n(regPending),
    regularInvalid: n(regInvalid),
    regularSubmitted: n(regSubmitted),
    internalAccApproved,
    internalTtdApproved,
    internalPending: n(intPending),
    totalAccApproved: regularAccApproved + internalAccApproved,
    totalTtdApproved: regularTtdApproved + internalTtdApproved,
    totalApproved: regularAccApproved + regularTtdApproved + internalAccApproved + internalTtdApproved,
  }
}

export interface CreatorMonthlyStats {
  accApproved: number
  ttdApproved: number
  totalApproved: number
  pending: number
  invalid: number
}

// Per-creator counts for a given calendar month. Used in admin Creators
// tab, Videos por Creadora rows, and any future per-creator widget.
export async function getCreatorMonthlyStats(
  admin: Admin,
  creatorId: string,
  month: number,
  year: number,
): Promise<CreatorMonthlyStats> {
  const { startOfMonth, endOfMonth } = getMonthBounds(month, year)
  const head = { count: 'exact' as const, head: true }
  const base = () => admin.from('go_boost_requests').select('id', head)
    .eq('creator_id', creatorId)
    .gte('created_at', startOfMonth).lte('created_at', endOfMonth)

  const [acc, ttd, pending, invalid] = await Promise.all([
    base().eq('video_type', 'ACC').eq('is_valid', true),
    base().eq('video_type', 'TTD').eq('is_valid', true),
    base().is('is_valid', null),
    base().eq('is_valid', false),
  ])

  const accApproved = acc.count ?? 0
  const ttdApproved = ttd.count ?? 0
  return {
    accApproved,
    ttdApproved,
    totalApproved: accApproved + ttdApproved,
    pending: pending.count ?? 0,
    invalid: invalid.count ?? 0,
  }
}
