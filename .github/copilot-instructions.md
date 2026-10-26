# Hotel Booking System — project instructions

These instructions apply throughout this workspace. System and developer instructions take precedence; explicit user requests override project defaults. Keep this file and .github/copilot-instructions.md consistent.

## Project and architecture

Build the SoftUni “Software Technologies with AI” capstone Hotel Booking System using:
- HTML, CSS, vanilla JavaScript ES modules and Bootstrap.
- Node.js, npm and Vite.
- Supabase Database, Auth and Storage.
- Render Static Site deployment.

Do not use TypeScript, React or Vue. Build a genuine multi-page application with separate HTML entry files and configure Vite to build every entry. Share components, services and utilities; centralize database access in services.

## Application scope

- Public hotel browsing and availability search.
- Guest registration, login and logout.
- Exactly one physical room per reservation, confirmed immediately when inventory is available.
- EUR prices and payment at the hotel; no online payment processing.
- Guest booking history and eligible cancellation.
- Admin management of hotels, room types, physical rooms, images and reservations.

Clarify cancellation eligibility, date boundaries, occupancy and pricing rules before implementing dependent behavior. Do not invent business policies.

## Database and security

- Enforce access control through database grants, row-level security and protected database operations. UI visibility is not authorization.
- Enforce valid reservation dates, room relationships and prevention of overlapping active reservations in the database, including concurrent requests.
- Check inventory and create the reservation atomically. Search results alone do not guarantee availability.
- Enforce guest ownership, admin permissions, reservation transitions and cancellation eligibility in the database.
- Preserve reservation price snapshots when catalog prices change.
- Apply access policies to Supabase Storage as well as database tables.
- Commit SQL migrations and synchronize them with remote migration history. Inspect both histories before applying changes; reconcile mismatches explicitly. Never silently rewrite applied migrations or make untracked remote schema changes.
- Never invent credentials, project identifiers or deployment URLs. Use placeholder values in examples.
- Never expose privileged keys in browser code, Vite-exposed environment variables or built assets. Keep secrets out of source control, logs and documentation.
- Render user content with textContent or equivalent safe DOM construction. Avoid untrusted HTML injection; explicitly sanitize any required rich HTML.

## Implementation workflow

- Inspect the workspace, applicable instructions, relevant files and Git state before making changes. Preserve working code and unrelated user changes.
- Implement only the current user-authorized milestone in docs/implementation-plan.md. Completion does not authorize starting the next milestone.
- Make focused, maintainable changes following established conventions. Avoid unrelated refactors and unnecessary dependencies.
- Build accessible, responsive interfaces with semantic HTML, labels, keyboard support, visible focus and useful feedback.
- Verify version-specific APIs against official documentation for the actual versions used. Never claim verification without performing it.
- Use PowerShell-compatible commands and quote paths. Prefer rg for searches. Verify resolved targets before recursive file operations.
- Do not discard unrelated changes or perform unauthorized destructive operations.
- Do not spawn sub-agents unless the user or applicable project guidance explicitly requests delegation.
- Give brief progress updates and resolve routine reversible choices independently. Ask when missing information materially affects correctness or authorization.

## Milestone completion

After each successful milestone:
1. Run relevant checks and the production build when available. Test changed behavior meaningfully, including database authorization and concurrent booking integrity where applicable.
2. Review the diff for scope, correctness, accidental changes and secrets.
3. Commit only that milestone's changes with a truthful descriptive message.
4. Push to the configured remote if available.
5. Report changes, checks actually run, limitations and commit/push results honestly.

The user authorizes milestone commits and pushes. Never force-push, backdate commits or manufacture Git history. If Git, a remote, credentials or tooling are unavailable, report the limitation without inventing configuration. Do not initialize a repository or select a remote solely to satisfy the checklist without user direction. Deployment requires user direction.

## Shared interface conventions

- Keep the home HTML entry at the root and other HTML page folders under pages/. Per-page JavaScript modules remain in src/pages/.
- Use semantic design tokens, Bootstrap and Bootstrap Icons. Keep substantial visual components modular and database access in services.
- Public navigation is Home, Hotels, Login and Register. Authenticated navigation is prepared for My Bookings, Account and Logout using injected verified state; do not simulate authentication.
- Hide all Admin navigation until role checking is implemented. Clearly label illustrative content and unavailable features; never fabricate hotel reviews, ratings or live availability.
- Mount exactly one top-right toast container directly under document.body. Use the shared accessible confirmation dialog, validation and feedback components.
- Preserve keyboard operation, visible focus, accessible contrast, responsive layouts and reduced-motion support. See docs/design-system.md.

## Booking engine conventions

- Use hotel-local calendar dates and half-open stays of 1–30 nights. Confirmed bookings block availability; cancelled bookings do not. Guests may cancel only before the local check-in date.
- Route application reservation writes through create_booking/cancel_booking. Derive identity and exact EUR prices server-side; retain exclusion constraints and private request-ledger authorization.
- Retry busy requests with the identical payload and request ID. Use a new ID for changed selections or an accepted re-quote. See docs/booking-engine.md for the RPC contract and checks.
