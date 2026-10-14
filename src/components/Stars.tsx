type Props = {
  value: number | null | undefined
  onChange?: (rating: number) => void
  size?: 'sm' | 'md' | 'lg'
  label?: string
}

export function Stars({ value, onChange, size = 'md', label }: Props) {
  const v = Math.round(value ?? 0)
  const interactive = Boolean(onChange)
  return (
    <div
      className={`stars stars-${size}${interactive ? ' stars-interactive' : ''}`}
      role={interactive ? 'radiogroup' : undefined}
      aria-label={label ?? (interactive ? 'Rate this swag' : `Rated ${v} out of 5`)}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`star${n <= v ? ' on' : ''}`}
          disabled={!interactive}
          onClick={() => onChange?.(n)}
          aria-label={`${n} star${n === 1 ? '' : 's'}`}
          aria-checked={interactive ? n === v : undefined}
          role={interactive ? 'radio' : undefined}
        >
          ★
        </button>
      ))}
    </div>
  )
}
