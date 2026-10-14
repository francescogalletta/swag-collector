import { Link } from 'react-router-dom'
import { DEFAULT_EVENT_SLUG } from '../lib/supabase'

export function StatusScreen({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="page status">
      <div className="card center">
        <div className="eyebrow">Swag Collector</div>
        <h1>{title}</h1>
        {detail && <p className="muted">{detail}</p>}
        {detail && (
          <p>
            <Link to={`/e/${DEFAULT_EVENT_SLUG}`} className="btn">
              Go to the demo event
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
