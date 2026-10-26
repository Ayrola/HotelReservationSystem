# Application access model

This document specifies intended permissions. It does not claim that tables, operations or policies already exist. No schema or policy changes are authorized in this milestone.

## Project inspection status

- Intended project name supplied by the user: HotelReservationSystem.
- Configured Supabase MCP project reference: `ekigrflijfhlmkimevpe`, confirmed with `codex mcp get supabase`.
- Remote project name and API URL: not yet confirmed through MCP.
- Existing remote tables: not yet confirmed. Do not assume the database is empty.
- Remote migration history: not yet confirmed. Local `supabase/migrations/` contains only `.gitkeep`, with no SQL migrations.
- Inspection failed with `MCP startup failed: OAuth token refresh failed: Failed to parse server response`. CLI reauthentication succeeded, but the current conversation's MCP client continues to report the same startup error. Restart/reconnect Codex before retrying remote inspection.

Before schema work, use read-only MCP operations to confirm project identity, API URL, existing tables (including exposed schemas and RLS status), and `list_migrations`. Compare remote versions with committed local SQL migrations and reconcile differences explicitly. Use `get_publishable_keys` to obtain only a browser-safe publishable key. Never fetch database passwords or privileged keys for the frontend. Do not claim synchronization until both histories have been inspected.

## Permission matrix

| Resource or operation | Visitor | Guest | Admin |
| --- | --- | --- | --- |
| Published hotels | Read | Read | Manage |
| Published room-type information | Read | Read | Manage |
| Published catalog images | Read | Read | Manage |
| Aggregate availability search | Search | Search | Search |
| Guest profiles | No access | Read/update permitted fields of own profile | No general profile access granted by this specification |
| Physical rooms/inventory | No access | No direct inventory access | Manage |
| Create booking | No | Authorized operation only | Only if a supported administration operation explicitly permits it |
| Read bookings | No | Own bookings only | All bookings |
| Cancel booking | No | Own eligible bookings through authorized operation | Supported administration operation only |
| Other reservation administration | No | No | Supported operations only |

Admin inherits public catalog and aggregate-search access. Access beyond this matrix requires an explicit business requirement. Reading a guest's reservation must not implicitly expose every field of their profile or the physical-room inventory.

## Enforcement requirements for later migrations

- The publishable key identifies the application, not an authenticated guest or administrator. A valid Supabase Auth session establishes the guest identity.
- Use database grants, row-level security and Storage policies to enforce these boundaries; client navigation and query filters are not authorization.
- Limit public catalog reads to published hotels and related published room-type/image records. Apply publication rules across relationships so unpublished hotel content cannot leak through child records.
- Availability must return only aggregate results for public room types and dates. Do not expose physical-room identifiers, room numbers, reservation rows, guest identities or raw inventory through public tables, views or operations.
- Guests may read their own profile and update only explicitly approved profile fields. The permitted field list remains a business decision; never allow self-assignment of roles, ownership or administrative flags.
- Guests may read only their own booking records and a deliberately limited room-type/hotel display projection. Do not grant direct physical-room inventory reads just because a reservation references a physical room.
- Booking creation must be an authenticated database operation deriving ownership from the session. It must validate dates, occupancy and pricing, allocate exactly one physical room, prevent overlaps under concurrency and confirm atomically when inventory exists. The client must not set owner, trusted prices or confirmation state freely.
- Cancellation must be an authenticated operation verifying ownership, agreed eligibility and allowed status transitions in the database. Do not grant guests unrestricted reservation UPDATE or DELETE access.
- Admin identity must come from a trusted role source that guests cannot edit. Admin operations need explicit grants and role checks; unsupported transitions remain forbidden. Admin tooling must preserve room relationships and existing reservations.
- Public Storage access, if used for published catalog images, must not expose private images. A public bucket alone cannot enforce per-file publication; plan bucket separation or authenticated/signed access accordingly. Upload, replace and delete access belongs to authorized admins.
- If privileged database functions become necessary, constrain their grants, search path, inputs and result shape. Do not use blanket permissive policies or expose owner-bypassing views accidentally.

## Browser client configuration

`src/services/supabase-client.js` reads only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. It creates one shared `supabaseClient` per loaded page when valid configuration exists. ES-module caching makes this instance common to imports on that page; normal multi-page navigation creates a fresh page runtime.

Copy `.env.example` to ignored `.env.local` and set the actual project API URL and a publishable key obtained from the verified project. Missing configuration exports a null client plus a clear `supabaseConfigurationError`; page composition displays the message and `requireSupabaseClient()` throws it for future data services. No fallback credentials or database requests are used.

Only HTTPS API origins and `sb_publishable_` keys are accepted. This application intentionally rejects legacy JWT keys to avoid confusing anon and service_role credentials. Vite also rejects known secret/password/connection settings and secret-key/JWT patterns in public environment variables before asset substitution. These checks cannot detect arbitrary secrets disguised as innocuous values; never place privileged values in any VITE_ variable. Vite variables are public in the built application, regardless of whether their source file is ignored.

The actual API URL and publishable key are not configured yet because MCP inspection is blocked. SDK initialization is implemented, but live project connectivity and data permissions have not been tested.

## Development tools are separate

Supabase MCP OAuth credentials, database administration tools and any future deployment credentials belong to the developer environment only. They are not application authentication and must never be copied into VITE_ variables, browser source, public assets or logs. MCP's ability to inspect a database does not prove that a visitor or guest can access it through the browser SDK.

This milestone creates no tables, migrations, policies, booking operations or guest/admin features. Future permission checks must use visitor, guest and admin application contexts, including negative tests; privileged MCP queries alone cannot validate RLS.

References verified for Supabase JS 2.118.0: [client initialization](https://supabase.com/docs/reference/javascript/initializing), [publishable and secret keys](https://supabase.com/docs/guides/getting-started/api-keys), and [MCP inspection tools](https://supabase.com/docs/guides/ai-tools/mcp).
