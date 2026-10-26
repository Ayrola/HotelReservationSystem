# Dedicated demo seed

Prefer a dedicated disposable demo project with the committed migrations applied. The user subsequently explicitly authorized execution against the configured production project. This script does not change schema or migration history. Always verify and confirm the intended project reference.

Use Node 22.15+ and `npm ci`. Supply the following through a server secret manager or an ignored `.env.seed.local` file at the repository root. Never use `VITE_` variables for these values, put the file under public/, commit it, paste secrets into commands, or run the seed in the browser or Render static-site build.

```dotenv
DEMO_PROJECT_REF=<dedicated-demo-project-reference>
DEMO_CONFIRM_PROJECT_REF=<same-dedicated-demo-project-reference>
DEMO_SUPABASE_SECRET_KEY=<server-secret-or-service-role-key>
DEMO_ADMIN_EMAIL=<chosen-admin-name>@example.invalid
DEMO_ADMIN_PASSWORD=<configured-demo-password-at-least-6-characters>
DEMO_GUEST_PASSWORD=<configured-demo-password-at-least-6-characters>
```

The project URL is derived exclusively from the required reference. The confirmation reference must match. Legacy service-role JWTs must also contain that reference; opaque secret keys are validated by the target API. The script never loads frontend `.env.local` or prints keys, passwords, emails or raw SDK errors. Use a trusted key copied from this project's dashboard.

PowerShell, from the repository root:

```powershell
node --env-file=.env.seed.local scripts/seed-demo.mjs --dry-run
node --env-file=.env.seed.local scripts/seed-demo.mjs --execute
```

If a secret manager already sets the process environment:

```powershell
npm run seed:demo -- --dry-run
npm run seed:demo -- --execute
```

Exactly one mode is required. Dry-run connects to the target and reads Auth users and application rows, but performs no writes. It needs valid server credentials. Counters distinguish actual `created`, `skipped`, `promoted`, `wouldCreate` and `wouldPromote`; dry-run creates zero records. Counts print even on partial failure, with a nonzero exit code.

On 2026-10-26, following explicit production authorization, a successful dry-run preceded execution against the configured production project. Actual counts: 4 accounts, 3 hotels, 9 room types, 27 rooms and 27 bookings created; zero seed records skipped; 1 configured admin promoted. Three trigger-created guest roles were already present and skipped by role provisioning. Images were not uploaded. Passwords were supplied through the ignored server environment, with a user-directed shorter demo password; minimum script length is now 6 characters and the target Auth policy still applies. No existing passwords were reset. No credentials are recorded here.

## Dataset and reruns

- Three explicitly fictional hotels in Sofia, Plovdiv and Bansko, each in `Europe/Sofia`.
- Solo, Double and Family types at each hotel, capacities 1/2/4; EUR nightly rates range from 45 to 135. Three physical rooms per type: 9 types and 27 rooms total.
- Three guests: `guest1@example.invalid`, `guest2@example.invalid`, `guest3@example.invalid`, plus the explicitly configured admin. All addresses must use the non-deliverable example.invalid domain. Auth Admin `createUser` confirms accounts without sending emails. No invites, OTPs or password-reset calls are made.
- Signup triggers create guest roles and profiles. Only the configured seed-owned admin receives an admin role. A later run with a different admin address stops. Unrelated accounts with a matching email are rejected, never adopted or promoted. Existing passwords are never updated; retain the original credentials separately.
- 27 confirmed bookings, one per room, starting 14 Sofia calendar days after execution and ending on day 18 (four nights). These make all seeded types unavailable during that interval and available outside it unless other bookings intervene. Database triggers derive price snapshots and events; exclusion constraints enforce overlap prevention. These are trusted server fixture inserts, not a replacement for the application's authenticated `create_booking` RPC.

Stable namespaced UUIDs identify catalog rows and bookings. Reruns skip existing matching rows and preserve booking dates, cancellations and price snapshots; they do not move historical bookings into the future. Catalog conflicts stop rather than overwrite operator edits. A successful initial execution reports 4 accounts, 3 hotels, 9 types, 27 rooms and 27 bookings created, and 1 promotion. Profiles, default guest roles and confirmation events are database-trigger side effects, not separately counted inserts. A successful unchanged rerun reports those records skipped. These are expected counts, not hosted execution results.

The seed is resumable but not one transaction across Auth and REST calls. Partial writes survive failure. Fix the reported problem and rerun with the same project and account configuration. Run only one seed process at a time; simultaneous runs can fail unique/exclusion constraints safely. No delete, password reset, truncation or unrelated-row update occurs. Existing conflicting inventory can prevent inserts; the script stops and preserves it. Service-role privileges are required; permission failures are not worked around with schema or grant changes.

## Local images

Existing assets: `public/images/hotel-exterior.jpg`, `hotel-room.jpg`, `hotel-pool.jpg`. They can be used as explicitly illustrative local assets, not photos of these fictional hotels. The script checks their existence and reports missing files for later supply; it invents no remote URLs. The current database accepts only real Storage paths, and a Storage bucket/policies are not yet implemented. Accordingly the seed creates no hotel_images metadata or Storage uploads. Upload these actual files and associate their real paths when Storage is authorized and configured.

## Verification

`npm run check:seed` covers no-write dry-run, first execution and rerun counts, single-admin provisioning, unrelated-account rejection, changed-admin rejection, catalog conflict preservation, project confirmation and Sofia calendar boundaries using an in-memory API double. It does not claim hosted Auth or REST verification. Existing SQL integrity/concurrency tests remain available through `npm run check:db`.

API references: [Auth Admin createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser), [paginated listUsers](https://supabase.com/docs/reference/javascript/auth-admin-listusers). The installed Auth SDK source was checked for createUser's no-email behavior.
