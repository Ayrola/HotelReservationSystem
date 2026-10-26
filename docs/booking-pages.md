# Booking review and confirmation

`/booking/` and `/booking-confirmation/` alias the existing HTML entries under pages/; original URLs still work. Hotel Reserve actions now use `/booking/`. Pages verify the current user and preserve the selected room type, dates and guests through Login. Logout/account changes remove access. Services verify the original account again before mutation/reconciliation.

Review calls `get_availability` for a fresh public room-type quote. URL prices, totals, owner IDs and success text are ignored. Hotel/type names, dates, nights, guests, nightly EUR rate and stay total come from the server. Payment is at the hotel, with no browser payment processing or room allocation. Guests may cancel only before the hotel-local check-in date.

Fields: required guest name (1–200 trimmed characters), optional phone (up to 40 trimmed characters), optional special requests (2,000 characters). Shared components provide labels, textarea, field errors and error summary. Own-profile data prefills the form. Values survive failure. Requests are not guaranteed.

## Attempt identity and recovery

A new attempt generates one `crypto.randomUUID()` and an immutable allowlisted payload. `create_booking` receives selected type/stay, guest details, request ID and observed expected prices, never an owner ID or trusted final price. PostgreSQL derives identity, verifies quotes, allocates atomically and saves price snapshots/events. A single in-flight promise and disabled submit prevent duplicate submissions.

Before submission, sessionStorage saves the request ID, exact payload and review labels under a key scoped to the verified user. This includes guest contact/request text, but no passwords/tokens. It is removed after a terminal response. Storage failure prevents submission. Unsent edits are not stored. Browser refresh/close is not intercepted with a native prompt; submitted pending attempts can be restored from tab storage.

RPCs have a 15-second client deadline. A timeout means unknown outcome. The controller first reads the owner's persisted booking by request ID; a found booking is used directly. Otherwise it locks the saved payload/UUID and offers Check status and retry. Every retry reconciles again before replaying the identical RPC request. This remains safe while an earlier transaction is committing. Busy/unknown results retain identity, with a bounded 0.5–4-second retry delay and no automatic retry loop. The private ledger stays unexposed.

`re_quote` is terminal for the old ID: fetch a fresh quote and require explicit acceptance in the shared dialog before a new attempt. `unavailable` never becomes confirmation and offers refresh/change-selection. Definitive validation errors retain form values. Cancelled replays show the actual cancelled booking and never create an automatic replacement. A different account cannot replay the original user's stored request.

The shared custom discard dialog guards ordinary in-app links and Logout while edits or a pending request exist. Active mutations block leaving until settled. Leaving a pending attempt warns that it may already have confirmed and does not cancel it. Recovery data stays saved. Notifications use the singleton top-right toast region. Browser Back/refresh/close and modified/new-tab navigation are not claimed to be covered by this custom link guard.

## Persisted confirmation

Confirmation validates one UUID ID, verifies authentication, and reads an explicit booking projection through RLS plus an owner filter. Reference/status, dates/guests and saved property/type/price snapshots come only from that row. No guest contacts, physical-room IDs or other guests' bookings are selected. Missing/unauthorized records show an unavailable state; cancelled records are labelled cancelled. Booking Details and My Bookings links remain links to their existing placeholder pages.

## Applied migration

`20261026194125_optional_booking_phone.sql` allows an empty phone string in the table constraint and private creation function; null remains invalid internally. Other creation/allocation/ownership/quote/idempotency logic and grants remain unchanged. No existing bookings were rewritten. Local and remote histories/hashes matched before application. The local file was aligned to the server-assigned version without editing applied SQL. Normalized SQL MD5 matches remote: `c34210626e10e844b8196795c9db86dc`.

## Checks

Short Node tests cover optional phone, payload allowlisting, recovery, duplicate clicks, lost-response reconciliation, lookup-before-replay, unchanged payload/UUID on retry, new ID after re-quote, cancelled recovery and storage failure. Focused local PostgreSQL checks cover blank phone, exact saved total, one booking after replay, no availability, stale price rejection, overlong phone and guest isolation. `node scripts/verify-database.mjs --booking-ui-only` skips the long historical/concurrency suites. Production build passed.

Live publishable-key reads recovered an existing seeded booking by its owner's request ID and verified another guest could not read it. No production bookings were created by verification. No Playwright, browser UI checks, live booking mutations or long concurrency suite were run, per user direction. Booking Details, My Bookings, cancellation UI and image uploads remain separate work.
