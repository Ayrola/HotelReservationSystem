# Server-side booking engine

Applied migration: `20261026184448_booking_engine.sql`, following `20261026182841_initial_hotel_schema.sql`. Both remote versions, names and normalized SQL hashes match local files. The new migration hash is `19acd4d877d092697ab45aff8673c139`. The initial SQL remains unchanged.

## Rules

Each booking receives exactly one physical room. Dates are hotel-local calendar dates and the stay is `[check_in, check_out)`, so a checkout and another check-in may share a date. Only confirmed reservations block inventory. New reservations require an active hotel, room type and room, a positive guest count within capacity, check-in no earlier than the hotel's local current date, and a stay of 1–30 nights.

All quotes, snapshots and totals use PostgreSQL numeric arithmetic: nightly EUR rate multiplied by calendar nights. Expected client prices are compared with server values, never inserted as trusted totals. Snapshot/name maintenance and the existing GiST exclusion constraint remain active. New insert eligibility is also enforced by a trigger, so future privileged write paths cannot skip these creation rules. Historical reservations are not rewritten.

## Public availability and quote

Call `get_availability` with:

| Parameter | Type | Meaning |
| --- | --- | --- |
| p_check_in | date | Arrival in hotel-local calendar dates |
| p_check_out | date | Exclusive departure date |
| p_guest_count | integer | Positive guest count |
| p_hotel_id | uuid or null | Optional hotel filter |
| p_room_type_id | uuid or null | Optional room-type filter |

Anonymous and authenticated callers receive rows containing hotel_id, room_type_id, hotel_name, room_type_name, hotel_timezone, capacity, available_rooms, nights, nightly_rate, total_price and currency. No guest data, booking rows, physical-room IDs or room numbers are returned. A matching published type with no inventory returns available_rooms = 0. Inactive catalog records, insufficient capacity and hotel-local past dates produce no matching row. Invalid date ranges, missing dates or nonpositive guest counts raise SQLSTATE `22023`.

Counts and quotes are observations, not inventory holds. Creation rechecks current eligibility and allocation before saving.

## Authenticated creation

The later [booking-page milestone](booking-pages.md) adds the optional-phone migration: an empty phone string is now accepted, while null and values over 40 trimmed characters remain invalid. The original applied engine migration is unchanged.

Call `create_booking` with all parameters:

| Parameter | Type |
| --- | --- |
| p_room_type_id | uuid |
| p_check_in, p_check_out | date |
| p_guest_count | integer |
| p_guest_name, p_contact_phone | text |
| p_special_requests | text; null becomes empty text |
| p_request_id | uuid |
| p_expected_nightly_rate, p_expected_total_price | numeric |

The caller's user ID comes from auth.uid(), not a supplied owner parameter. Name and phone are trimmed and validated; special requests are length-limited. Expected prices must be finite, nonnegative and have no fractional cents. Currency is always EUR. The existing total_price numeric(12,2) limit is enforced: totals above 9,999,999,999.99 raise `22003` rather than overflow or create a partial reservation.

The returned JSON has `outcome`, `replayed`, and, where applicable, `booking` or `quote`:

| Outcome | Meaning and caller action |
| --- | --- |
| confirmed | A reservation exists; use the returned booking ID/reference |
| cancelled | A replay refers to an existing booking that is now cancelled; do not create a replacement automatically |
| re_quote | Current rate or total differs; no booking was created. Display/refetch the quote and obtain guest acceptance before a new request |
| unavailable | No eligible catalog/inventory exists; no booking was created |
| retryable_busy | Allocation, request-key or catalog locks were busy; retry the identical payload/request ID with a bounded client backoff |

Booking responses contain only the caller-authorized reservation summary: ID/reference/status, dates, guest count, price/name snapshots and cancellation time. They omit physical-room identifiers and contact/special-request fields. No guest can create on behalf of another account, including an admin using this endpoint.

### Request identity

The private ledger keys requests by `(user_id, request_id)` and stores a SHA-256 hash of the normalized payload. The fingerprint covers room type, dates, guests, trimmed name/phone, special requests, expected rate/total and EUR. Numeric quotes are normalized to two decimal places; equivalent numeric spellings and trimmed surrounding name/phone spaces are equivalent.

An upsert followed by a row lock serializes duplicate keys. Successful retries return the same booking, including its current cancellation state; they do not recompute it using later catalog prices or create another event. Pre-existing booking keys are backfilled without altering their bookings.

Different payloads using an already-bound key raise `22023`, including a changed accepted price after a re-quote. Use a **new request ID** for a changed selection/payload, acceptance of a new quote, or a new attempt after a terminal unavailable result. Re-quote and unavailable responses are terminal and cached for that key. Transient contention is not cached as a terminal response. A busy result after ledger creation preserves its fingerprint; a failure waiting for an uncommitted competing ledger transaction leaves no local writes. Validation errors and rolled-back transactions are not accepted bookings.

### Allocation and retries

The function holds shared hotel/type locks to stabilize activity, capacity and quote. It selects one available active room with `FOR UPDATE SKIP LOCKED`, and the insert triggers recheck eligibility and fill authoritative snapshots. At most three allocation attempts run; exclusion conflicts roll back that attempt before retry. Rooms held by other transactions are skipped. A 2-second lock timeout bounds individual waits for request/catalog locks. No sleeps or unbounded allocation loop run inside the booking function.

The exclusion constraint arbitrates overlaps even if another future writer fails to follow the allocation protocol. Retries after contention must run in a new transaction/RPC; callers must not report busy, re-quote or unavailable as confirmed reservations.

## Authorized cancellation

`cancel_booking(p_booking_id uuid)` requires authentication. The owner or a trusted admin may cancel. Guests can cancel only while hotel-local today is strictly before check_in; admins may cancel on/after check-in. Activity flags do not prevent cancellation of an existing reservation.

The booking row is locked before checking/modifying status. The row and snapshots are preserved, cancelled_at is server-generated, and the existing audit trigger records the caller and status transition without sensitive details. Repeating a cancellation returns `cancelled` with replayed = true and adds no event. An inaccessible or unknown booking produces the same `42501` error. Contention can return retryable_busy.

## Privileges and isolation

Public RPC wrappers are SECURITY INVOKER. Elevated implementations are in the unexposed private schema, pin search_path to empty, schema-qualify application objects and check authorization explicitly. Execute grants are revoked from PUBLIC and then granted narrowly: availability to anon/authenticated, mutations to authenticated only. Pure helpers and eligibility trigger functions are not directly executable by browser roles.

Direct booking and booking_event mutation remains revoked. The private ledger has RLS, no browser table grants and no policies; owner-executed functions are its only application path. It stores payload hashes instead of duplicating guest names/contact/special requests. Keep the private schema out of Supabase's exposed API schemas.

The security advisor reports one intentional informational [RLS enabled with no policy notice](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) for private.booking_requests. Adding an allow policy to silence this would weaken the intended deny-by-default boundary. No warning/error security findings were reported.

## Verification

`npm run check:db` applies both migrations to an isolated local PostgreSQL 17 instance, testing the original schema before the engine migration so existing-key backfill is exercised. Auth roles and auth.uid are local fixtures; no hosted test users or bookings are created.

Tests cover public data shape, aggregate counts, exact prices, max-stay/invalid-input limits, local-vs-session dates, inactive catalog/rooms, capacity, tampered/stale quotes, idempotent retries, changed payloads, per-user key scope, snapshots, overlaps and adjacency, inventory release, owner/admin boundaries, same-day cancellation, repeat cancellation, direct-write denials and event actors/counts.

Two-connection tests cover distinct-room allocation, simultaneous identical/mismatched request IDs, last-room contention, identical retries after room locks, catalog lock timeouts preserving fingerprints, concurrent cancellation producing one event, and concurrent price changes producing a re-quote. The existing raw concurrent insert test independently exercises the exclusion constraint.

Live verification checks migration SQL hashes, function configuration/grants, the exclusion/eligibility triggers and denied direct table writes. Publishable-key RPC requests confirmed public availability/30-night validation and anonymous mutation denials. Successful authenticated flows are tested locally; they are not a claim that login or booking UI is implemented. Application build, 15 production-page checks and four configuration tests also passed.

References checked: [PostgreSQL 17 row locking](https://www.postgresql.org/docs/17/sql-select.html), [Read Committed transactions](https://www.postgresql.org/docs/17/transaction-iso.html), [hotel-local date/time operations](https://www.postgresql.org/docs/17/functions-datetime.html), and [Supabase function security/grants](https://supabase.com/docs/guides/database/functions).
