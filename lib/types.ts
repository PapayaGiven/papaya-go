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
  approved_at: string | null
  created_at: string
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
  is_active: boolean
  times_sold: number
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
