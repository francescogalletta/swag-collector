import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { DEFAULT_EVENT_SLUG } from './lib/supabase'
import { AttendeePage } from './pages/Attendee'
import { BoardPage, QrPage } from './pages/Board'
import { StatusScreen } from './components/StatusScreen'

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<Navigate to={`/e/${DEFAULT_EVENT_SLUG}`} replace />} />
        <Route path="/e/:slug" element={<AttendeePage />} />
        <Route path="/e/:slug/board" element={<BoardPage />} />
        <Route path="/e/:slug/qr" element={<QrPage />} />
        <Route path="*" element={<StatusScreen title="Page not found" detail="That link doesn't go anywhere." />} />
      </Routes>
    </BrowserRouter>
  )
}
