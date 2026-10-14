import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import type {
  EventRow,
  SwagItemRating,
  SwagTypeCount,
  Vendor,
  VendorLeaderboardRow,
} from './types'

export type EventData = {
  event: EventRow | null
  vendors: Vendor[]
  items: SwagItemRating[]
  vendorBoard: VendorLeaderboardRow[]
  typeCounts: SwagTypeCount[]
  myVotes: Record<string, number>
  myItemIds: Set<string>
  loading: boolean
  error: string | null
  live: boolean
  refresh: () => Promise<void>
}

/**
 * Loads everything for one event and keeps it fresh via Supabase Realtime.
 * Any insert/update on vendors, swag_items or votes triggers a debounced refetch
 * of the aggregated views, so every phone and the big screen converge on the
 * same numbers within a few hundred ms.
 */
export function useEventData(slug: string, attendeeId?: string): EventData {
  const [event, setEvent] = useState<EventRow | null>(null)
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [items, setItems] = useState<SwagItemRating[]>([])
  const [vendorBoard, setVendorBoard] = useState<VendorLeaderboardRow[]>([])
  const [typeCounts, setTypeCounts] = useState<SwagTypeCount[]>([])
  const [myVotes, setMyVotes] = useState<Record<string, number>>({})
  const [myItemIds, setMyItemIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [live, setLive] = useState(false)
  const eventIdRef = useRef<string | null>(null)

  // Resolve slug -> event once.
  useEffect(() => {
    let cancelled = false
    supabase
      .from('events')
      .select('*')
      .eq('slug', slug)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setError(error.message)
          setLoading(false)
          return
        }
        if (!data) {
          setError(`No event found for "${slug}".`)
          setLoading(false)
          return
        }
        eventIdRef.current = data.id
        setError(null)
        setEvent(data as EventRow)
      })
    return () => {
      cancelled = true
    }
  }, [slug])

  const refresh = useCallback(async () => {
    const eventId = eventIdRef.current
    if (!eventId) return
    const [v, i, b, t, mv, mi] = await Promise.all([
      supabase.from('vendors').select('*').eq('event_id', eventId).order('name'),
      supabase
        .from('swag_item_ratings')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })
        .limit(500),
      supabase.from('vendor_leaderboard').select('*').eq('event_id', eventId),
      supabase.from('swag_type_counts').select('*').eq('event_id', eventId),
      attendeeId
        ? supabase.from('votes').select('swag_item_id, rating').eq('attendee_id', attendeeId)
        : Promise.resolve({ data: [], error: null }),
      attendeeId
        ? supabase.from('swag_items').select('id').eq('attendee_id', attendeeId).eq('event_id', eventId)
        : Promise.resolve({ data: [], error: null }),
    ])
    const firstError = [v, i, b, t, mv, mi].find((r) => r.error)?.error
    if (firstError) {
      setError(firstError.message)
    } else {
      setError(null)
      setVendors((v.data ?? []) as Vendor[])
      setItems((i.data ?? []) as SwagItemRating[])
      setVendorBoard((b.data ?? []) as VendorLeaderboardRow[])
      setTypeCounts((t.data ?? []) as SwagTypeCount[])
      const votes: Record<string, number> = {}
      for (const row of (mv.data ?? []) as { swag_item_id: string; rating: number }[]) {
        votes[row.swag_item_id] = row.rating
      }
      setMyVotes(votes)
      setMyItemIds(new Set(((mi.data ?? []) as { id: string }[]).map((r) => r.id)))
    }
    setLoading(false)
  }, [attendeeId])

  // Initial load + realtime subscription once we know the event id.
  useEffect(() => {
    if (!event) return
    void refresh()

    let timer: ReturnType<typeof setTimeout> | null = null
    const scheduleRefresh = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => void refresh(), 250)
    }

    const channel = supabase
      .channel(`event:${event.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'swag_items', filter: `event_id=eq.${event.id}` },
        scheduleRefresh,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'vendors', filter: `event_id=eq.${event.id}` },
        scheduleRefresh,
      )
      // votes has no event_id column; listen to all and let the refetch filter.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'votes' }, scheduleRefresh)
      .subscribe((status) => {
        setLive(status === 'SUBSCRIBED')
      })

    // Safety net: realtime can drop on flaky conference Wi-Fi.
    const poll = setInterval(() => void refresh(), 15000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      if (timer) clearTimeout(timer)
      clearInterval(poll)
      document.removeEventListener('visibilitychange', onVisible)
      void supabase.removeChannel(channel)
      setLive(false)
    }
  }, [event, refresh])

  return {
    event,
    vendors,
    items,
    vendorBoard,
    typeCounts,
    myVotes,
    myItemIds,
    loading,
    error,
    live,
    refresh,
  }
}

/** Items ranked for the "best swag" board: needs at least one vote. */
export function rankItems(items: SwagItemRating[]): SwagItemRating[] {
  return items
    .filter((i) => i.votes > 0 && i.avg_rating != null)
    .sort(
      (a, b) =>
        (b.avg_rating ?? 0) - (a.avg_rating ?? 0) ||
        b.votes - a.votes ||
        a.created_at.localeCompare(b.created_at),
    )
}

/** Vendors ranked by generosity (items logged), then by how well-liked they are. */
export function rankVendors(rows: VendorLeaderboardRow[]): VendorLeaderboardRow[] {
  return rows
    .filter((r) => r.items_logged > 0)
    .sort(
      (a, b) =>
        b.items_logged - a.items_logged ||
        (b.avg_rating ?? 0) - (a.avg_rating ?? 0) ||
        b.votes - a.votes,
    )
}
