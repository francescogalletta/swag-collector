export function LiveBadge({ live }: { live: boolean }) {
  return (
    <span className={`live-badge${live ? ' on' : ''}`} title={live ? 'Realtime connected' : 'Reconnecting…'}>
      <span className="dot" />
      {live ? 'Live' : 'Connecting'}
    </span>
  )
}
