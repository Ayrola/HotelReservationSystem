# Admin catalog management

The existing `/pages/admin/` entry is now the catalog dashboard. Every admin screen verifies Supabase Auth identity and reads the current user's trusted `user_roles` row. Non-admins see an access-denied state; missing sessions go to Login with a safe local return URL. Navigation shows Admin only after a verified admin role read. Role metadata supplied during signup is ignored. Admin controls and all writes remain protected by existing PostgreSQL grants/RLS; inventory reads remain admin-only. Role/identity changes fail closed in the UI, and services recheck admin access before saving.

Pages:

- `/pages/admin/hotels/`: list published and inactive hotels, view/edit, activate/deactivate and remove.
- `/pages/admin/hotel-edit/?id=...`: separate hotel form; omit ID to create. Name, destination, address and timezone are required. Description is optional. Supported IANA names come from the admin-only database timezone operation and match the existing timezone trigger. Europe/Sofia is the create-form default.
- `/pages/admin/hotel-view/?id=...`: hotel details, room-type list, create/edit/state/remove actions and inventory link.
- `/pages/admin/room-type-edit/?hotelId=...&id=...`: separate room-type form; omit ID to create. Name, description, positive integer capacity, nonnegative EUR nightly rate with at most two decimals and active state. The hotel relationship is fixed in this editor.
- `/pages/admin/rooms/?hotelId=...`: private physical-room list and hotel selector.
- `/pages/admin/room-edit/?hotelId=...&id=...`: separate physical-room form; omit ID to create. Trimmed room number, a room type in that hotel and active state. Booking-history room-type changes are rejected by the existing database trigger; hotel-wide room-number uniqueness is enforced in PostgreSQL.

Forms keep their values and expose inline errors/summary after failure. Saves stay on the same form with the persisted ID; subsequent saves update rather than duplicate. In-app link/logout navigation prompts before discarding dirty drafts. State changes and removal use the shared custom confirmation dialog. Outcomes use the shared singleton top-right toast region. No browser alert/confirm is used.

## Deletion and integrity

Applied migration: `20261026195340_admin_catalog_operations.sql`. Local and remote histories and existing SQL hashes were inspected and matched before application. The new migration filename was aligned with its returned remote version without editing the applied SQL.

`admin_remove_catalog` uses an invoker public wrapper and pinned-search-path private definer with explicit authenticated-admin checks, an allowlist of entity kinds and row locks. Rooms with any booking history are deactivated. Room types with rooms and hotels with dependent types/image metadata are also deactivated, even without bookings, avoiding destructive cascades. Only unreferenced records are deleted. Concurrent new references either block behind the lock or cause a safe foreign-key failure; no history is deleted. Parent deactivation hides it from public search and prevents new allocation without modifying existing bookings/snapshots.

Existing room relationships, composite foreign keys, capacity/history triggers, booking exclusion constraints, RLS and least-privilege grants remain active. UI forms do not expose cross-hotel relationship moves. Direct privileged deletes that would violate references remain database errors; the admin UI uses the protected delete/deactivate operation. No public role-mutation RPC was added.

## Trusted first-admin bootstrap

`scripts/bootstrap-admin.mjs` requires an explicit existing Auth UUID and project reference, validates the account through supported Auth Admin `getUserById`, and promotes only that user's existing guest role. It never creates an Auth account, changes a password, sends email or promotes every user. An already-admin target is skipped; another existing admin causes refusal, since this is a first-admin tool. The production seed already provisioned one configured admin, so there is no reason to run this script to create another. Run bootstrap once, from one trusted operator process; it is not a concurrent multi-admin provisioning tool.

Keep a secret/service-role key in the server environment as `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`. The existing ignored seed configuration's `DEMO_SUPABASE_SECRET_KEY` is also accepted. Never use a `VITE_` secret, put this script/key in public assets, or commit environment files. Legacy JWTs must match the explicit target reference; modern server keys are validated by that target API. If a project URL is supplied in the environment, it must also match.

PowerShell, replacing both placeholders with the actual chosen existing account and project:

```powershell
node --env-file=.env.seed.local scripts/bootstrap-admin.mjs --project-ref '<project-reference>' --user-id '<existing-auth-uuid>' --dry-run
node --env-file=.env.seed.local scripts/bootstrap-admin.mjs --project-ref '<project-reference>' --user-id '<existing-auth-uuid>' --execute
```

Exactly one explicit mode is required. Dry-run reads only. Output reports promoted/skipped/planned counts without printing keys or account details. A failed prerequisite stops without creating, resetting or promoting other accounts. No bootstrap was executed in this milestone.

Per explicit user direction, no tests, build, browser checks or runtime validation suite were run. The migration was applied successfully; frontend behavior remains unverified by execution. Storage/image administration and admin reservation workflows are outside this scope.
