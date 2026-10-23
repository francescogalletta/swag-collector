# Swag Collector

Mobile-first web app for conferences: attendees scan a QR code, log the swag they pick up, rate it 1–5, and watch a live leaderboard of the best merch and the most generous companies. No login — each phone gets an anonymous attendee id. Everything lives in Supabase and updates in real time on every phone and on the organizer's big screen.

## Routes

| Path | Who | What |
| --- | --- | --- |
| `/` | — | Redirects to the default event (`VITE_DEFAULT_EVENT_SLUG`, currently `demo`) |
| `/e/:slug` | Attendees | Log swag, rate items, see the feed, leaderboard and your own swag |
| `/e/:slug/board` | Organizer | Big-screen live leaderboard with the join QR code and a "just logged" ticker |
| `/e/:slug/qr` | Organizer | Full-screen QR code only (tap to return to the board) |

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production bundle in dist/
npm run preview    # serve the production bundle
npm run lint       # oxlint
```

`.env` holds the Supabase project URL and the **publishable** key. Both are public by design (they ship in the browser bundle) so the file is committed; `.env.example` is identical. To point at another project, change the values there.

## Supabase

The project (`swag-collector`, ref `cszircituveqitecfzib`) is already provisioned. The frontend only uses what exists:

- Tables: `events`, `vendors`, `swag_items`, `votes` (RLS on, anonymous insert/select, update on votes).
- Views: `swag_item_ratings`, `vendor_leaderboard`, `swag_type_counts` for the boards.
- Realtime publication on `vendors`, `swag_items`, `votes`.
- `votes` is unique per `(swag_item_id, attendee_id)`, so re-rating is an upsert.
- `vendors` is unique per `(event_id, lower(name))`; the app reuses an existing vendor by name and handles the race where two phones create the same vendor at once.

Client behaviour worth knowing:

- Attendee id is a UUID in `localStorage` (`swag:attendee_id`); the optional display name is `swag:attendee_name`.
- Every page subscribes to Postgres changes for its event and refetches the views (debounced). A 15 s poll and a refetch on tab focus cover dropped websockets on conference Wi-Fi.
- "Best swag" ranks by average rating, then vote count; only items with at least one vote appear. "Most generous companies" ranks by items logged, then average rating.

## Adding another event

Insert a row into `events` with a new `slug` and `name`, then share `https://<host>/e/<slug>`. The board for it is at `/e/<slug>/board`.

## Deploying

It is a static Vite app. `vercel.json` and `public/_redirects` (Netlify) already rewrite every path to `index.html` so deep links work. The QR code encodes the deployed origin automatically.
