import { useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase, DEFAULT_EVENT_SLUG } from '../lib/supabase'
import { getAttendeeId, getAttendeeName, setAttendeeName } from '../lib/attendee'
import { rankItems, rankVendors, useEventData } from '../lib/useEventData'
import { SWAG_TYPES, swagEmoji, type SwagItemRating } from '../lib/types'
import { fmtRating, timeAgo } from '../lib/format'
import { Stars } from '../components/Stars'
import { LiveBadge } from '../components/LiveBadge'
import { Rank } from '../components/Rank'
import { StatusScreen } from '../components/StatusScreen'

type Tab = 'feed' | 'top' | 'mine'

export function AttendeePage() {
  const { slug = DEFAULT_EVENT_SLUG } = useParams()
  const attendeeId = useMemo(() => getAttendeeId(), [])
  const data = useEventData(slug, attendeeId)
  const [name, setName] = useState(getAttendeeName)
  const [editingName, setEditingName] = useState(false)
  const [tab, setTab] = useState<Tab>('feed')
  const [localVotes, setLocalVotes] = useState<Record<string, number>>({})
  const [justLogged, setJustLogged] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const votes = { ...data.myVotes, ...localVotes }

  const flash = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  const rate = async (item: SwagItemRating, rating: number) => {
    setLocalVotes((v) => ({ ...v, [item.swag_item_id]: rating }))
    const { error } = await supabase
      .from('votes')
      .upsert(
        { swag_item_id: item.swag_item_id, attendee_id: attendeeId, rating },
        { onConflict: 'swag_item_id,attendee_id' },
      )
    if (error) {
      flash(`Couldn't save vote: ${error.message}`)
      setLocalVotes((v) => {
        const next = { ...v }
        delete next[item.swag_item_id]
        return next
      })
      return
    }
    void data.refresh()
  }

  if (data.error && !data.event) {
    return <StatusScreen title="Event not found" detail={data.error} />
  }
  if (!data.event) return <StatusScreen title="Loading…" />

  const rankedItems = rankItems(data.items)
  const rankedVendors = rankVendors(data.vendorBoard)
  const mine = data.items.filter((i) => data.myItemIds.has(i.swag_item_id))
  const justLoggedItem = justLogged ? data.items.find((i) => i.swag_item_id === justLogged) : null

  return (
    <div className="page attendee">
      <header className="topbar">
        <div>
          <div className="eyebrow">Swag Collector</div>
          <h1>{data.event.name}</h1>
        </div>
        <LiveBadge live={data.live} />
      </header>

      <section className="card identity">
        {editingName ? (
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault()
              setAttendeeName(name)
              setName(getAttendeeName())
              setEditingName(false)
            }}
          >
            <input
              autoFocus
              value={name}
              maxLength={40}
              placeholder="Your name (optional)"
              onChange={(e) => setName(e.target.value)}
            />
            <button type="submit" className="btn">
              Save
            </button>
          </form>
        ) : (
          <div className="row between">
            <span className="muted">
              {name ? (
                <>
                  Logging as <strong>{name}</strong>
                </>
              ) : (
                'Logging anonymously'
              )}
            </span>
            <button type="button" className="link" onClick={() => setEditingName(true)}>
              {name ? 'Change name' : 'Add your name'}
            </button>
          </div>
        )}
      </section>

      <LogForm
        eventId={data.event.id}
        attendeeId={attendeeId}
        attendeeName={name}
        vendors={data.vendors}
        onLogged={(id) => {
          setJustLogged(id)
          setTab('feed')
          flash('Swag logged! 🎉')
          void data.refresh()
        }}
        onError={flash}
      />

      {justLoggedItem && (
        <section className="card highlight">
          <div className="row between">
            <strong>
              {swagEmoji(justLoggedItem.swag_type)} Rate your {justLoggedItem.swag_type.toLowerCase()} from{' '}
              {justLoggedItem.vendor_name}
            </strong>
            <button type="button" className="link" onClick={() => setJustLogged(null)}>
              Dismiss
            </button>
          </div>
          <Stars size="lg" value={votes[justLoggedItem.swag_item_id]} onChange={(r) => rate(justLoggedItem, r)} />
        </section>
      )}

      <nav className="tabs" role="tablist">
        <TabButton id="feed" current={tab} onSelect={setTab} count={data.items.length}>
          Feed
        </TabButton>
        <TabButton id="top" current={tab} onSelect={setTab}>
          Leaderboard
        </TabButton>
        <TabButton id="mine" current={tab} onSelect={setTab} count={mine.length}>
          My swag
        </TabButton>
      </nav>

      {tab === 'feed' && (
        <ItemList
          items={data.items}
          votes={votes}
          onRate={rate}
          empty="No swag logged yet. Be the first!"
        />
      )}

      {tab === 'top' && (
        <>
          <section className="card">
            <h2>🏆 Best swag</h2>
            {rankedItems.length === 0 ? (
              <p className="muted">Rate a few items and the board will light up.</p>
            ) : (
              <ol className="board-list">
                {rankedItems.slice(0, 10).map((i, idx) => (
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
                      <strong>{fmtRating(i.avg_rating)}</strong>
                      <small>
                        {i.votes} vote{i.votes === 1 ? '' : 's'}
                      </small>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
          <section className="card">
            <h2>🎁 Most generous companies</h2>
            {rankedVendors.length === 0 ? (
              <p className="muted">No vendors yet.</p>
            ) : (
              <ol className="board-list">
                {rankedVendors.slice(0, 10).map((v, idx) => (
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
          </section>
          <section className="card">
            <h2>📦 What's being handed out</h2>
            <TypeBars counts={data.typeCounts} />
          </section>
        </>
      )}

      {tab === 'mine' && (
        <ItemList items={mine} votes={votes} onRate={rate} empty="You haven't logged any swag yet." />
      )}

      <footer className="footer muted">
        Organizer? Open the <Link to={`/e/${slug}/board`}>live board</Link> on a big screen.
      </footer>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  )
}

function TabButton({
  id,
  current,
  onSelect,
  count,
  children,
}: {
  id: Tab
  current: Tab
  onSelect: (t: Tab) => void
  count?: number
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={current === id}
      className={`tab${current === id ? ' active' : ''}`}
      onClick={() => onSelect(id)}
    >
      {children}
      {count != null && count > 0 && <span className="pill">{count}</span>}
    </button>
  )
}

function ItemList({
  items,
  votes,
  onRate,
  empty,
}: {
  items: SwagItemRating[]
  votes: Record<string, number>
  onRate: (item: SwagItemRating, rating: number) => void
  empty: string
}) {
  if (items.length === 0) {
    return (
      <section className="card">
        <p className="muted center">{empty}</p>
      </section>
    )
  }
  return (
    <ul className="item-list">
      {items.map((i) => (
        <li key={i.swag_item_id} className="card item">
          <div className="item-head">
            <span className="emoji big">{swagEmoji(i.swag_type)}</span>
            <div className="grow">
              <div className="title">
                {i.swag_type} <span className="muted">from</span> {i.vendor_name}
              </div>
              {i.description && <div className="sub">{i.description}</div>}
              <div className="meta muted">
                {i.attendee_name ? i.attendee_name : 'Someone'} · {timeAgo(i.created_at)}
              </div>
            </div>
            <div className="score">
              <strong>{fmtRating(i.avg_rating)}</strong>
              <small>
                {i.votes} vote{i.votes === 1 ? '' : 's'}
              </small>
            </div>
          </div>
          <div className="row between rate-row">
            <span className="muted small">{votes[i.swag_item_id] ? 'Your rating' : 'Rate it'}</span>
            <Stars value={votes[i.swag_item_id]} onChange={(r) => onRate(i, r)} />
          </div>
        </li>
      ))}
    </ul>
  )
}

export function TypeBars({ counts }: { counts: { swag_type: string; total: number }[] }) {
  const sorted = [...counts].sort((a, b) => b.total - a.total)
  const max = sorted[0]?.total ?? 0
  if (sorted.length === 0) return <p className="muted">Nothing yet.</p>
  return (
    <ul className="type-bars">
      {sorted.map((c) => (
        <li key={c.swag_type}>
          <span className="label">
            {swagEmoji(c.swag_type)} {c.swag_type}
          </span>
          <span className="bar">
            <span className="fill" style={{ width: `${(c.total / max) * 100}%` }} />
          </span>
          <span className="n">{c.total}</span>
        </li>
      ))}
    </ul>
  )
}

function LogForm({
  eventId,
  attendeeId,
  attendeeName,
  vendors,
  onLogged,
  onError,
}: {
  eventId: string
  attendeeId: string
  attendeeName: string
  vendors: { id: string; name: string }[]
  onLogged: (swagItemId: string) => void
  onError: (msg: string) => void
}) {
  const [vendorName, setVendorName] = useState('')
  const [swagType, setSwagType] = useState<string>('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)

  const canSubmit = vendorName.trim().length > 0 && swagType.length > 0 && !busy

  const resolveVendor = async (): Promise<string> => {
    const wanted = vendorName.trim()
    const existing = vendors.find((v) => v.name.toLowerCase() === wanted.toLowerCase())
    if (existing) return existing.id

    const { data, error } = await supabase
      .from('vendors')
      .insert({ event_id: eventId, name: wanted })
      .select('id')
      .single()
    if (!error && data) return data.id

    // Unique index on (event_id, lower(name)): someone else just created it. Look it up.
    if (error?.code === '23505') {
      const { data: found, error: findErr } = await supabase
        .from('vendors')
        .select('id')
        .eq('event_id', eventId)
        .ilike('name', wanted)
        .limit(1)
        .maybeSingle()
      if (found) return found.id
      throw new Error(findErr?.message ?? 'Vendor lookup failed')
    }
    throw new Error(error?.message ?? 'Could not create vendor')
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setBusy(true)
    try {
      const vendorId = await resolveVendor()
      const { data, error } = await supabase
        .from('swag_items')
        .insert({
          event_id: eventId,
          vendor_id: vendorId,
          swag_type: swagType,
          description: description.trim() || null,
          attendee_id: attendeeId,
          attendee_name: attendeeName.trim() || null,
        })
        .select('id')
        .single()
      if (error || !data) throw new Error(error?.message ?? 'Insert failed')
      setSwagType('')
      setDescription('')
      onLogged(data.id)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card log-form" onSubmit={submit}>
      <h2>Got some swag?</h2>

      <label className="field">
        <span>Who gave it to you?</span>
        <input
          list="vendor-options"
          value={vendorName}
          placeholder="Company name"
          maxLength={60}
          autoComplete="off"
          onChange={(e) => setVendorName(e.target.value)}
        />
        <datalist id="vendor-options">
          {vendors.map((v) => (
            <option key={v.id} value={v.name} />
          ))}
        </datalist>
      </label>

      <div className="field">
        <span>What is it?</span>
        <div className="chips" role="radiogroup" aria-label="Swag type">
          {SWAG_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={swagType === t}
              className={`chip${swagType === t ? ' on' : ''}`}
              onClick={() => setSwagType(t)}
            >
              {swagEmoji(t)} {t}
            </button>
          ))}
        </div>
      </div>

      <label className="field">
        <span>Details (optional)</span>
        <input
          value={description}
          placeholder="e.g. Black tee with the mascot, size L"
          maxLength={120}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>

      <button type="submit" className="btn primary big" disabled={!canSubmit}>
        {busy ? 'Logging…' : 'Log it'}
      </button>
    </form>
  )
}
