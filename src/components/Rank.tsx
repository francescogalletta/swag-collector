export function Rank({ n }: { n: number }) {
  const medal = n === 1 ? '🥇' : n === 2 ? '🥈' : n === 3 ? '🥉' : null
  return <span className={`rank${medal ? ' medal' : ''}`}>{medal ?? n}</span>
}
