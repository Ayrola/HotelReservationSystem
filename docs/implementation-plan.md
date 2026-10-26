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

## Milestone 2 — Supabase schema, access and booking integrity

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
