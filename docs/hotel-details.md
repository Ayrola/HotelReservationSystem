# Hotel details

`/hotel/?id=<hotel-uuid>` and the original `/pages/hotel/` entry now show the published property name, destination, address, description, gallery and active room types. Home and results links use the shorter route. Vite aliases it in development and emits `dist/hotel/index.html` in production, while source HTML remains under pages/.

The service loads the hotel, active room-type descriptions/capacities/EUR rates and image metadata in one nested Supabase query. Explicit published filters also apply to admin sessions, in addition to existing RLS. Missing, inactive or malformed hotel IDs show a safe unavailable state. Database content uses textContent and DOM construction.

Gallery figures use actual configured Storage URLs, descriptive alt text, captions and native keyboard-accessible links to full images in a new tab. Missing configuration, missing photos and failed image loads show explicit fallback messages; no stock photography is represented as a property photo.

The shared search form provides hotel-local check-in/check-out and guests. Both dates can be blank for indicative rates only. A dated selection requires a 1–30-night calendar stay and a positive PostgreSQL integer guest count. Invalid and repeated URL selections do not fetch availability. Input is preserved after validation or service failures. Each edit immediately disables Reserve and invalidates all earlier quote requests, then starts a debounced recheck. Earlier successes, failures and sign-in checks cannot update or navigate after a selection changes. Valid selections are written back to the URL without converting calendar strings to local/UTC timestamps.

Each availability recheck calls `get_availability` once for the entire property. Room cards distinguish indicative catalog prices from the RPC's current nightly rate, nights and exact total. Reserve stays disabled without a valid dated quote, positive room availability or sufficient capacity. No room IDs or guest reservation data are requested. Availability is observational and must be rechecked by the booking operation.

Reserve verifies identity with Auth `getUser` before navigating. A verified user continues to `/pages/booking/` with hotel/room-type IDs, dates, guests and observed expected quote values; an anonymous visitor continues to `/pages/login/?next=<encoded-booking-url>`. This generated return path is local, not taken from arbitrary URL input. Quote parameters are observations, not trusted booking prices. Login was subsequently implemented in the [authentication milestone](authentication.md); booking submission remains a placeholder. No physical room allocation or payment is performed in the browser.

Verification: nine short Node tests for detail IDs, malformed/duplicate selections, date limits, stale-response suppression, Reserve eligibility and parameter preservation; production build. Live publishable-key queries passed for the seeded hotel's three published types, an available period, a seeded fully booked period and a missing hotel. No database changes, Playwright or long regression checks were run. Gallery keyboard/screen-reader and visual behavior were reviewed in source, not browser-tested.

Reference checked: [Supabase Auth getUser](https://supabase.com/docs/reference/javascript/auth-getuser).
