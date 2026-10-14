export type EventRow = {
  id: string
  slug: string
  name: string
  created_at: string
}

export type Vendor = {
  id: string
  event_id: string
  name: string
  created_at: string
}

export type SwagItemRating = {
  swag_item_id: string
  event_id: string
  vendor_id: string
  vendor_name: string
  swag_type: string
  description: string | null
  attendee_name: string | null
  created_at: string
  votes: number
  avg_rating: number | null
}

export type VendorLeaderboardRow = {
  vendor_id: string
  event_id: string
  vendor_name: string
  items_logged: number
  votes: number
  avg_rating: number | null
}

export type SwagTypeCount = {
  event_id: string
  swag_type: string
  total: number
}

export const SWAG_TYPES = [
  'T-shirt',
  'Sticker',
  'Hoodie',
  'Socks',
  'Bottle',
  'Tote bag',
  'Hat',
  'Pen',
  'Notebook',
  'Snack',
  'Gadget',
  'Other',
] as const

export const SWAG_EMOJI: Record<string, string> = {
  'T-shirt': '👕',
  Sticker: '✨',
  Hoodie: '🧥',
  Socks: '🧦',
  Bottle: '🍶',
  'Tote bag': '👜',
  Hat: '🧢',
  Pen: '🖊️',
  Notebook: '📓',
  Snack: '🍫',
  Gadget: '🔌',
  Other: '🎁',
}

export function swagEmoji(type: string): string {
  return SWAG_EMOJI[type] ?? '🎁'
}
