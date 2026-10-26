# Implementation plan

## Milestone 0 — project guidance and planning (completed)

Scope: update AGENTS.md, create consistent .github/copilot-instructions.md, and create this plan. Do not implement application features.

Initial inspection: only AGENTS.md existed. There was no application code, package manifest, build tooling or Git repository.

Acceptance: review all three documents for consistency and scope; confirm no application features were introduced. Run checks/build when available, review the diff, commit and push where configuration permits. Repository initialization and remote selection require user direction.

## Milestone 1 — multi-page foundation

Implementation complete for the requested placeholder scope. Verified with Node 22.15.0, Vite 8.3.5, Bootstrap 5.3.8, Popper 2.11.8 and Supabase JS 2.118.0.

Verification passed: clean `npm ci`, JavaScript syntax checks, `npm run build`, and `npm run check:pages`. All 15 HTML entries exist in `dist` and production preview serves each matching file. The preview check also verifies 17 linked assets, known navigation destinations, all three selected-record query URL formats, parameter parsing and a 404 for unknown pages. Instruction files still match exactly.

Limitations: interactive browser keyboard, collapse and viewport testing has not been performed. Source files were reviewed directly; a Git diff, commit and push are unavailable because this workspace is not a Git repository. No deployment was performed. Await user direction before beginning milestone 2.

Establish npm, Vite, Bootstrap, JavaScript ES modules, shared styles, components, services and utilities. Create separate HTML entries for public browsing, hotel details, authentication, guest bookings and administration, with accessible responsive navigation. Document environment configuration using placeholders and ignore local secrets.

This milestone is limited to placeholders and navigation. No Supabase client, authentication, availability, booking or admin functionality is implemented. The user explicitly selected all 15 HTML entries, including booking confirmation, booking details and account pages. Selected-record query parameters are displayed safely as placeholder context only.

Agree on business rules before dependent implementation: hotel-local booking dates, checkout boundaries, occupancy, pricing and cancellation eligibility.

Acceptance: install from the lockfile, run available checks and production build, verify every HTML entry and navigation in development and built output, and check keyboard and narrow-screen usability. Do not implement booking or admin features yet.

## Milestone 1b — Supabase client and access model (completed)

Scope: inspect the intended Supabase project through configured MCP, create a shared browser-safe client and document visitor/guest/admin permissions. Do not create tables or policies.

Implemented: shared client, missing-configuration feedback, build-time checks for known privileged public environment settings and docs/access-model.md. Client initialization is composed in page modules; visual components remain independent of services. The actual project URL and publishable key are now configured in ignored .env.local after MCP reconnection.

Checks passed: four configuration/service tests (including real SDK singleton initialization with explicit test-only values), production build, all 15 production-preview entries and seven existing browser tests. Live visitor reads/denials were verified after the subsequent database migration.

The earlier OAuth inspection blocker was resolved after reconnecting. Live MCP verified project reference ekigrflijfhlmkimevpe and the project API URL. Initial inspection found no application tables/migrations and zero Auth users. The actual URL and publishable key are now configured in ignored .env.local. Live visitor permissions were verified after the authorized schema migration.

## Milestone 2a — initial database migration (applied and verified)

The user-authorized initial schema was applied through Supabase MCP as version 20261026182841, initial_hotel_schema. Local filename and normalized SQL hash match remote history. All eight tables, RLS, least-privilege grants, safe signup/backfill, integrity triggers, overlap/idempotency constraints and immutable snapshots/audit history are implemented. See docs/database.md.

Local PostgreSQL 17 tests passed, including two competing reservation transactions. Live schema/grants introspection, visitor API permissions and Supabase security advisor checks passed. Build, page/configuration/UI checks also passed. No remote fixtures or test users were added.

Aggregate availability and reservation creation/cancellation/admin RPCs and Storage object policies remain deferred. No booking or admin UI feature is authorized by this migration. Continue only with the next user-directed scope.

## Current milestone: 2b — server-side booking engine (applied and verified)

Applied booking_engine migration 20261026184448 after local PostgreSQL tests. Local and remote versions/names/SQL hashes match. Public aggregate availability/quotes, authenticated create_booking and owner/admin cancel_booking are implemented. Exact numeric pricing, active inventory, 1–30 hotel-local nights, capacity, stale-quote rejection, private request-ledger idempotency, room locking, bounded retries, preserved exclusion protection and server-generated cancellation events are enforced.

Checks passed: original schema tests, engine SQL tests, eight RPC concurrency scenarios plus the raw overlapping-insert race, live RPC permissions/validation, remote grants/function introspection, build, 15 production entries and four configuration tests. The advisor's sole informational notice is intentional deny-by-default RLS on private.booking_requests. No hosted fixtures or test users were created. See docs/booking-engine.md.

Booking/login UI, Storage policies and broader admin reservation operations remain outside this milestone. Await the next user-directed scope.

## Milestone 2c — remaining storage policies and administration operations

Design hotels, room types, physical rooms, reservations, roles and image metadata. Implement committed SQL migrations, indexes, constraints, grants, RLS and Storage policies. Establish trusted admin provisioning. Implement protected atomic room allocation/reservation creation and eligible cancellation, including booking price snapshots. Each reservation has one physical room and immediate confirmation.

Inspect local and remote migration histories before synchronization; reconcile differences explicitly. Obtain real configuration rather than inventing it.

Acceptance: apply migrations to a clean test database when available. Verify guest isolation, anonymous/admin permissions, Storage access, valid dates, room relationships, cancellation rules and competing concurrent reservations. Confirm local/remote history alignment after remote application. Report unavailable remote checks explicitly.

## Milestone 3 — guest authentication

Implement registration, login, logout, session handling and guest navigation through shared Supabase services. Handle confirmation and redirects according to actual Supabase configuration. Keep privileged operations out of browser code.

Acceptance: verify registration, configured confirmation flow, login/logout, session persistence, invalid credentials and restricted access. Run relevant checks and build.

## Milestone 4 — public catalog and availability

Implement hotel browsing, details, room types, images and availability search with agreed date and occupancy validation. Show EUR prices and pay-at-hotel terms. Handle loading, empty and error states.

Acceptance: verify date boundaries, unavailable inventory, public visibility rules, safe content rendering, responsive layout and keyboard access. Run relevant checks and build.

## Milestone 5 — reservations and guest history

Connect booking to the atomic database operation. Show immediate confirmation with the assigned physical room, dates, price snapshot and pay-at-hotel information. Add guest booking history and eligible cancellation enforced by the database. Handle stale search results, inventory conflicts and repeated submission safely.

Acceptance: verify successful bookings, competing requests, overlapping dates, permitted checkout/check-in boundaries, ownership isolation, history and eligible/ineligible cancellation. Run relevant checks and build.

## Milestone 6 — administration

Implement admin management of hotels, room types, physical rooms, images and reservations with database and Storage authorization. Preserve existing reservation integrity when inventory changes. Agree on permitted reservation transitions before exposing them.

Acceptance: verify admin workflows, guest/anonymous rejection at the database layer, image policies, invalid inputs and handling of records referenced by reservations. Run relevant checks and build.

## Milestone 7 — integration, deployment and capstone handoff

Review public, guest and admin flows, accessibility, responsiveness, error handling and security. Document setup, configuration, migration workflow and demonstration steps. Configure Render Static Site for actual Vite multi-page output and actual Supabase Auth redirect settings. Preserve direct links to separate pages.

Acceptance: run relevant checks and production build, inspect built assets for secrets, verify direct navigation and core flows against the configured environment. Deploy only when directed, using real supplied or provisioned URLs. Record actual results and limitations.

## Rules for every milestone

Implement only the milestone authorized by the user. After successful checks, review the diff, commit only milestone changes and push to the configured remote if available. Preserve unrelated work. Never force-push, backdate commits or manufacture history. Report unavailable checks and Git/deployment limitations honestly. Completing a milestone does not authorize starting the next.
