import { Link, useParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { DEFAULT_EVENT_SLUG } from '../lib/supabase'
import { rankItems, rankVendors, useEventData } from '../lib/useEventData'
import { swagEmoji } from '../lib/types'
import { fmtRating, joinUrl, timeAgo } from '../lib/format'
import { LiveBadge } from '../components/LiveBadge'
import { Rank } from '../components/Rank'
import { StatusScreen } from '../components/StatusScreen'
import { TypeBars } from './Attendee'

export function BoardPage() {
  const { slug = DEFAULT_EVENT_SLUG } = useParams()
  const data = useEventData(slug)

  if (data.error && !data.event) return <StatusScreen title="Event not found" detail={data.error} />
  if (!data.event) return <StatusScreen title="Loading…" />

  const items = rankItems(data.items)
  const vendors = rankVendors(data.vendorBoard)
  const totalVotes = data.vendorBoard.reduce((n, v) => n + Number(v.votes), 0)
  const url = joinUrl(slug)
  const latest = data.items.slice(0, 6)

  return (
    <div className="board">
      <header className="board-head">
        <div>
          <div className="eyebrow">Swag Collector · live leaderboard</div>
          <h1>{data.event.name}</h1>
        </div>
        <div className="stats">
          <Stat n={data.vendorBoard.filter((v) => v.items_logged > 0).length} label="companies" />
          <Stat n={data.items.length} label="swag logged" />
          <Stat n={totalVotes} label="ratings" />
          <LiveBadge live={data.live} />
        </div>
      </header>

      <main className="board-grid">
        <section className="panel join">
          <h2>Scan to play</h2>
          <Link to={`/e/${slug}/qr`} className="qr" title="Open full-screen QR">
            <QRCodeSVG value={url} size={240} level="M" marginSize={2} bgColor="#ffffff" fgColor="#0f0f14" />
          </Link>
          <p className="url">{url.replace(/^https?:\/\//, '')}</p>
          <p className="muted">Log the swag you pick up, rate it 1–5, watch this board move.</p>
          <h3>Just logged</h3>
          {latest.length === 0 ? (
            <p className="muted">Waiting for the first item…</p>
          ) : (
            <ul className="ticker">
              {latest.map((i) => (
                <li key={i.swag_item_id}>
                  <span className="emoji">{swagEmoji(i.swag_type)}</span>
                  <span className="grow">
                    <strong>{i.vendor_name}</strong> {i.swag_type.toLowerCase()}
                    {i.attendee_name ? ` · ${i.attendee_name}` : ''}
                  </span>
                  <span className="muted">{timeAgo(i.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel">
          <h2>🏆 Best swag</h2>
          {items.length === 0 ? (
            <p className="muted empty">No ratings yet. Scan the code and rate something!</p>
          ) : (
            <ol className="board-list xl">
              {items.slice(0, 8).map((i, idx) => (
                <li key={i.swag_item_id}>
                  <Rank n={idx + 1} />
                  <span className="emoji">{swagEmoji(i.swag_type)}</span>
                  <span className="grow">
                    <span className="title">
                      {i.swag_type} · {i.vendor_name}
                    </span>
                    {i.description && <span className="sub">{i.description}</span>}
                  </span>
                  <span className="score">
                    <strong>{fmtRating(i.avg_rating)} ★</strong>
                    <small>
                      {i.votes} vote{i.votes === 1 ? '' : 's'}
                    </small>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="panel">
          <h2>🎁 Most generous companies</h2>
          {vendors.length === 0 ? (
            <p className="muted empty">No vendors yet.</p>
          ) : (
            <ol className="board-list xl">
              {vendors.slice(0, 8).map((v, idx) => (
                <li key={v.vendor_id}>
                  <Rank n={idx + 1} />
                  <span className="grow">
                    <span className="title">{v.vendor_name}</span>
                    <span className="sub">
                      avg {fmtRating(v.avg_rating)} ★ · {v.votes} vote{v.votes === 1 ? '' : 's'}
                    </span>
                  </span>
                  <span className="score">
                    <strong>{v.items_logged}</strong>
                    <small>item{v.items_logged === 1 ? '' : 's'}</small>
                  </span>
                </li>
              ))}
            </ol>
          )}
          <h3>📦 Swag breakdown</h3>
          <TypeBars counts={data.typeCounts} />
        </section>
      </main>
    </div>
  )
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="stat">
      <strong>{n}</strong>
      <span>{label}</span>
    </div>
  )
}

export function QrPage() {
  const { slug = DEFAULT_EVENT_SLUG } = useParams()
  const data = useEventData(slug)
  const url = joinUrl(slug)
  return (
    <div className="board qr-only">
      <Link to={`/e/${slug}/board`} className="qr-card">
        <div className="eyebrow">{data.event?.name ?? 'Swag Collector'}</div>
        <h1>Scan to log your swag</h1>
        <QRCodeSVG value={url} size={420} level="M" marginSize={2} bgColor="#ffffff" fgColor="#0f0f14" />
        <p className="url">{url.replace(/^https?:\/\//, '')}</p>
        <p className="muted">Tap anywhere to go back to the board</p>
      </Link>
    </div>
  )
}
