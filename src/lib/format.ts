export function timeAgo(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime())
  const s = Math.floor(diff / 1000)
  if (s < 45) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export function fmtRating(n: number | null | undefined): string {
  if (n == null) return '–'
  return Number(n).toFixed(1)
}

/** Absolute attendee URL, honouring a sub-path deploy (Vite's BASE_URL always ends with "/"). */
export function joinUrl(slug: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}e/${slug}`
}
