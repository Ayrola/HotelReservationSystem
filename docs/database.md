# Initial database migration

Project: HotelReservationSystem (user-supplied name), reference `ekigrflijfhlmkimevpe`. The project API URL was confirmed through live Supabase MCP as `https://ekigrflijfhlmkimevpe.supabase.co`.

## Applied state

Before applying, MCP inspection found no tables in public/private, no migration history, zero Auth users and PostgreSQL 17.11. No existing application data was replaced.

Applied through Supabase MCP `apply_migration` as `initial_hotel_schema`. The server recorded version `20261026182841`. The local file is [20261026182841_initial_hotel_schema.sql](../supabase/migrations/20261026182841_initial_hotel_schema.sql). Its filename was aligned with the server-assigned version after application; the applied SQL was not changed.

Both local and remote histories contain this one migration. Normalized SQL MD5 (line endings and surrounding whitespace normalized) is `bc0fe8c38c01f9d69a28593b0ab491c4` on both sides. The remote history stores the same SQL as one statement entry. Use migration tooling for subsequent changes; never edit this applied file or repair history to conceal differences.

## Schema and invariants

- Eight application tables: profiles, user_roles, hotels, room_types, rooms, hotel_images, bookings and booking_events. Every table has a UUID primary key and RLS enabled.
- Authentication remains in auth.users. Profiles contain no passwords. Signup and existing-account backfill initialize a profile and guest role, never an admin role from metadata. Existing profile/role rows are not overwritten.
- Trusted provisioning may promote a user through privileged database tooling. No browser role-write grant exists. The private.is_admin helper uses a pinned empty search path and reads roles as its trusted owner, so RLS does not recursively query itself.
- Profile owners may update only display_name and phone. updated_at is maintained by a trigger. Catalog timestamps are maintained as well.
- Hotels start inactive. Published catalog reads require an active hotel and, for room types, an active room type. UTC and named IANA zones are accepted; invalid zones and bare timezone abbreviations are rejected.
- rooms.hotel_id is derived from its room type. A composite FK enforces consistency and a unique (hotel_id, room_number) constraint enforces hotel-wide room numbering across room types. The same number in another hotel is permitted.
- Room types have positive capacity, nonnegative finite numeric EUR rates and indexed hotel relationships. One cover image per hotel is allowed; image paths are relative storage paths, not external URLs.
- Bookings require finite dates with checkout after check-in and positive guests within the chosen room's capacity. The database fills price and hotel/type name snapshots from the active catalog. Total price equals nightly-rate snapshot multiplied by nights.
- The GiST exclusion constraint prevents overlapping confirmed stays for a physical room, including simultaneous transactions. Checkout is exclusive, allowing consecutive stays.
- Each user/request_id pair and each booking reference is unique. This supplies the idempotency constraint; a future creation RPC must return/reconcile the existing reservation safely on retries.
- Reservation details and snapshots become immutable. Only confirmed-to-cancelled is permitted at the integrity layer; cancellation time is set by the database. Cancelled reservations cannot be revived. No guest or admin has direct mutation grants, so this trigger is not an authorization or cancellation-eligibility API.
- Booking deletion is rejected. Referenced rooms, room types, hotels and booked Auth users cannot be deleted. Booked rooms cannot move to another room type, and capacity reductions cannot invalidate confirmed reservations. Account anonymization/deletion requires a separately designed retention workflow.
- Confirmation and cancellation append audit events automatically. Events contain only status-transition details, not names, contact details or special requests. Updates/deletes are rejected. Actor IDs are nullable for trusted system operations and foreign-key protected when present.

## Access boundaries and deferred operations

Visitors read only published catalog rows; they cannot read bookings, profiles, roles, physical rooms or audit events. Guests read their own profile/role/bookings. Admins manage catalog and physical rooms and read all reservations and audit events, without blanket profile access or direct booking mutation.

Aggregate availability, booking creation, eligible cancellation and supported admin reservation RPCs are **not exposed yet**. Their implementation must define date/occupancy/cancellation policies, authorize callers, preserve the constraints and avoid leaking inventory. This initial migration intentionally keeps all reservation writes closed to browser roles. No permissive bypass policy was added.

This migration covers image metadata. Storage buckets, object upload/publication policies and asset administration remain a separate migration; no public bucket was created.

## Verification performed

`npm run check:db` uses the installed PostgreSQL binaries (17.6 tested), creates a temporary loopback-only instance, applies the actual migration in a transaction and runs local tests with anon/authenticated roles and a minimal auth.users/auth.uid fixture. It does not connect to the hosted database or run the real Supabase Auth service. Test data remains local and the test server/directory are removed afterwards. Set POSTGRES_BIN when binaries are not on PATH or the default Windows installation path.

Tests passed for signup/backfill, ignored metadata roles, catalog visibility, profile isolation and allowed fields, denied guest/admin booking mutation, forbidden role writes, admin catalog access, timezone/capacity/rate/currency/date checks, hotel-wide room numbering, snapshots, per-user idempotency, deletion restrictions, lifecycle/audit integrity and a two-connection competing-reservation test. No test accounts or hotel fixtures were inserted remotely.

After application, live introspection confirmed all eight tables, their primary keys and RLS, the signup trigger, overlap/idempotency constraints, restricted profile grants and absent reservation/role-write grants. Supabase's security advisor returned no findings. Using only the browser publishable key, live catalog SELECT requests succeeded and protected-table SELECT requests returned permission-denied errors.

The production build, 15 production-page checks, four configuration tests and seven Chromium UI tests are separate application checks. Remote guest/admin end-to-end tests await real authentication workflows; local RLS tests are not a claim that those workflows already exist.

References: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Auth user management](https://supabase.com/docs/guides/auth/managing-user-data), [migration history](https://supabase.com/docs/guides/deployment/database-migrations), [PostgreSQL range exclusions](https://www.postgresql.org/docs/17/rangetypes.html).
