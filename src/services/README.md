# Services

Shared Supabase and other data access services belong here. Import the single `supabaseClient` from `supabase-client.js`, or use `requireSupabaseClient()` to obtain it with a clear error when configuration is missing. Never create additional clients per component or use privileged keys in browser services.

Visual components do not import this service. Application composition in `src/pages/application.js` displays missing configuration without disabling placeholder navigation. No catalog or booking queries are implemented. See `docs/access-model.md` for intended permissions and remote inspection status.
