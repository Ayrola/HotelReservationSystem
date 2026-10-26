# Hotel Booking System

SoftUni “Software Technologies with AI” capstone. Current implementation: multi-page placeholders and normal link navigation only. Authentication, database access, booking and administration are not implemented.

## Local setup

Use Node.js 22.12+ (Node 22.15.0 verified) and npm.

```sh
npm ci
npm run dev
npm run build
npm run check:pages
npm run check:config
npx playwright install chromium
npm run check:ui
npm run preview
```

`check:pages` starts production preview on a temporary loopback port, verifies all 15 generated HTML files against HTTP responses, checks linked assets and navigation destinations, checks selected-record query URLs, and confirms unknown pages return 404. It closes preview afterwards. It does not replace interactive browser accessibility checks.

The dev and preview commands print their local URL. Navigation uses ordinary anchors and separate HTML files. Every page has its own module in `src/pages`; the shared entry inventory is `src/pages/entries.js`. Vite 8 uses its top-level `input` option and `appType: 'mpa'`.

## Selected-record URLs

- `/pages/hotel/?id=...`
- `/pages/booking/?roomTypeId=...&checkIn=...&checkOut=...&guests=...`
- `/pages/booking-details/?id=...`

These parameters are displayed as untrusted text in placeholders. They do not select actual database records or create reservations. Admin pages remain placeholders with no navigation links until role checking is implemented.

## Configuration and structure

Copy `.env.example` to `.env.local` only when real Supabase configuration is available. Set `VITE_SUPABASE_URL` to the verified HTTPS project API URL and `VITE_SUPABASE_PUBLISHABLE_KEY` to its browser-safe publishable key. Restart Vite or rebuild after changes. Never use secret keys, service_role keys or database passwords in browser code or any VITE_ variable.

`src/services/supabase-client.js` exports the single shared client. Without configuration it exports a null client and a clear error displayed by page composition; placeholder navigation still works. No database queries are implemented yet. Vite rejects known privileged public environment settings before bundling. See [docs/access-model.md](docs/access-model.md) for visitor, guest and admin permissions and the blocked remote inspection status. No real project URL or key has been invented or configured.

- `pages`: all non-home HTML page folders, including nested administration pages. The home entry remains `index.html`.
- `src/components`: shared page initialization and navigation behavior.
- `src/pages`: one ES module per HTML page and the entry inventory.
- `src/services`: future shared data services.
- `src/utils`: safe query-parameter reading.
- `src/styles`: shared styles alongside Bootstrap.
- `supabase/migrations`: future committed SQL migrations.
- `scripts`: repeatable verification.
- `docs`: implementation plan and project documentation.

Bootstrap CSS and Bootstrap Icons are bundled by Vite. Navigation uses a shared keyboard-accessible mobile toggle. Popper is installed for future Bootstrap components that need it. No CDN dependency or SPA router is used. `dist/` and local environment files are ignored. The lockfile is committed when Git becomes available.

The shared design system is documented in [docs/design-system.md](docs/design-system.md). The home page includes clearly labelled examples of reusable cards, controls, validation, dialog, notifications and loading/empty states. No real reservations or authentication actions are offered. `check:ui` runs Chromium tests against production preview, including mobile keyboard interaction and automated accessibility checks.

Future Render Static Site settings: build with `npm ci && npm run build`, publish `dist`. No SPA fallback rewrite is needed. No deployment or Supabase project is configured by this milestone.

## References checked for installed versions

- [Vite 8 build options](https://v8.vite.dev/config/build-options) and [shared input option](https://v8.vite.dev/config/shared-options).
- [Bootstrap 5.3 JavaScript and dependencies](https://getbootstrap.com/docs/5.3/getting-started/javascript/).
- [Supabase JavaScript SDK installation](https://supabase.com/docs/reference/javascript/installing).
