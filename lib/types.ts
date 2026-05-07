export interface Creator {
  id: string
  email: string
  full_name: string | null
  tiktok_handle: string | null
  nivel: number
  gmv_total: number
  gmv_this_month: number
  acc_this_month: number
  ttd_this_month: number
  videos_this_month: number
  status: 'pending' | 'active' | 'suspended'
  access_code: string | null
  acc_goal: number | null
  ttd_goal: number | null
  gmv_goal: number | null
  special_hashtags: string | null
  creative_brief: string | null
  mediakit_url: string | null
  approved_at: string | null
  created_at: string
  is_internal: boolean
  daily_quota: number
  weekly_quota: number
  monthly_quota: number
}

export interface TikTokAccount {
  id: string
  tiktok_handle: string
  tiktok_url: string | null
  is_active: boolean
  notes: string | null
  created_at: string
}

export type InternalVideoStatus = 'pending' | 'approved' | 'rejected'

export interface InternalVideo {
  id: string
  creator_id: string
  tiktok_account_id: string | null
  tiktok_url: string
  video_type: 'ACC' | 'TTD'
  status: InternalVideoStatus
  submitted_at: string
  approved_at: string | null
  rejected_at: string | null
  rejection_reason: string | null
  creator?: { full_name: string | null; email: string } | null
  tiktok_account?: { tiktok_handle: string; tiktok_url: string | null } | null
}

export interface POI {
  id: string
  name: string
  type: 'hotel' | 'attraction' | 'restaurant'
  city: string
  state: string
  commission: string
  perk: string | null
  min_nivel: number
  capcut_template_url: string | null
  image_emoji: string | null
  cta_label: string | null
  cta_url: string | null
  is_active: boolean
  times_sold: number
  poi_category: string | null
  is_viral_poi: boolean
  papaya_visited: boolean
  created_at: string
}

export interface CapCutTemplate {
  id: string
  title: string
  description: string | null
  url: string
  min_nivel: number
  video_type: 'ACC' | 'TTD' | 'general'
  created_at: string
}

export interface NivelRequirement {
  nivel: number
  name: string
  acc_required: number
  ttd_required: number
  total_videos_required: number
  gmv_required: number
  perks: string | null
  resources_unlocked: string | null
}

export interface PortfolioSubmission {
  id: string
  creator_id: string
  media_kit_url: string | null
  stats_screenshot_url: string | null
  video_links: string[]
  status: 'pending' | 'reviewed' | 'pitched'
  notes: string | null
  created_at: string
  creator?: { full_name: string | null; email: string; nivel: number } | null
}

export interface Announcement {
  id: string
  message: string
  image_url: string | null
  image_file_url?: string | null
  display_type: 'banner' | 'popup'
  is_active: boolean
  created_at: string
}

export const NIVEL_NAMES: Record<number, string> = {
  1: 'Explorer',
  2: 'Contributor',
  3: 'Partner',
  4: 'Elite',
}

export const NIVEL_COLORS: Record<number, { bg: string; text: string; border: string }> = {
  1: { bg: 'bg-go-pink/20', text: 'text-pink-700', border: 'border-go-pink' },
  2: { bg: 'bg-go-peach/20', text: 'text-orange-700', border: 'border-go-peach' },
  3: { bg: 'bg-go-orange/20', text: 'text-orange-800', border: 'border-go-orange' },
  4: { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-400' },
}

export const POI_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  hotel: { label: 'Hotel (ACC)', color: 'bg-blue-100 text-blue-700' },
  attraction: { label: 'Atracción (TTD)', color: 'bg-purple-100 text-purple-700' },
  restaurant: { label: 'Restaurante', color: 'bg-emerald-100 text-emerald-700' },
}

export interface NivelReward {
  id: string
  nivel: number
  reward_name: string
  reward_description: string | null
  reward_emoji: string
  cta_label: string | null
  cta_url: string | null
  cta_type: 'none' | 'link' | 'form' | 'upload' | 'whatsapp'
  cta_whatsapp_message: string | null
  form_fields: FormField[] | null
  is_active: boolean
  created_at: string
}

export interface FormField {
  label: string
  type: 'text' | 'textarea' | 'email' | 'tel' | 'dropdown' | 'checkbox'
  required: boolean
  options?: string[]
}

export interface RewardRequest {
  id: string
  creator_id: string
  creator_name: string | null
  tiktok_handle: string | null
  nivel: number
  reward_id: string
  reward_name: string
  notes: string | null
  status: string
  created_at: string
}

export type BoostStatus = 'pending' | 'boosteado' | 'rechazado'

export interface BoostRequest {
  id: string
  creator_id: string
  creator_name: string | null
  tiktok_handle: string | null
  tiktok_url: string | null
  video_url: string | null
  boost_reason: string | null
  notes: string | null
  // Legacy single-status field. New code uses is_valid + boost_status.
  status: string
  video_type: 'ACC' | 'TTD' | null
  rejection_reason: string | null
  // Split status (added 2026-05): is_valid drives video counting,
  // boost_status drives whether Papaya amplifies the video.
  // is_valid is tri-state: null = not reviewed, true = válido, false = inválido.
  is_valid: boolean | null
  boost_status: BoostStatus
  // Did the creator REQUEST a boost on submission? Admin only sees the
  // boost approval buttons when this is true.
  boost_requested: boolean
  created_at: string
}

export interface Challenge {
  id: string
  title: string
  description: string | null
  challenge_type: 'most_videos' | 'highest_gmv' | 'most_acc' | 'most_ttd'
  prize: string | null
  prize_description: string | null
  start_date: string
  end_date: string
  is_active: boolean
  created_at: string
}

export const CHALLENGE_TYPE_LABELS: Record<string, string> = {
  most_videos: 'Más videos',
  highest_gmv: 'Mayor GMV',
  most_acc: 'Más ACC',
  most_ttd: 'Más TTD',
}

export const NIVEL_BORDER_COLORS: Record<number, string> = {
  1: '#ff9ece',
  2: '#ffa552',
  3: '#ff7700',
  4: '#d4a017',
}

export interface MonthlyGoal {
  id: string
  month: number
  year: number
  acc_goal: number
  ttd_goal: number
  created_at: string
  updated_at: string | null
}

export interface MonthlySnapshot {
  id: string
  month: number
  year: number
  total_acc_videos: number
  total_ttd_videos: number
  total_gmv: number
  total_creators: number
  new_creators: number
  internal_acc_videos: number
  internal_ttd_videos: number
  snapshot_taken_at: string
  updated_at: string
}

export interface CreatorSnapshot {
  id: string
  creator_id: string
  month: number
  year: number
  acc_videos: number
  ttd_videos: number
  total_videos: number
  gmv: number
  nivel: number
  snapshot_taken_at: string
}

export interface LevelUpEvent {
  id: string
  creator_id: string
  from_nivel: number
  to_nivel: number
  carry_acc: number
  carry_ttd: number
  carry_total: number
  leveled_up_at: string
}

export const NIVEL_EMOJIS: Record<number, string> = {
  1: '🌸',
  2: '🌺',
  3: '🧡',
  4: '👑',
}

export interface TopPoi {
  id: string
  name: string
  county: string | null
  poi_id: string | null
  poi_type: 'ACC' | 'TTD'
  rank: number | null
  is_active: boolean
  synced_at: string
}
