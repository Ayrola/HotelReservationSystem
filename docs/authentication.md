# Guest authentication

Login and registration use the existing `/pages/login/` and `/pages/register/` HTML entries, shared accessible fields and browser-safe Supabase client. No privileged key or direct auth.users insertion is involved. No schema change is needed: the applied signup trigger already creates profiles and guest roles, and ignores roles in editable metadata. Registration submits only display_name as metadata.

Login calls `signInWithPassword`, then verifies the resulting identity using `getUser`. Registration calls `signUp`, validates name/password confirmation, and handles both a session returned immediately and the email-confirmation-required response. The current project's public Auth settings were read: email authentication and signup are enabled, with email confirmation required. Session-less signup displays a generic check-your-email message and does not treat the user as authenticated or reveal whether an account already exists. Server password requirements, rate limits and disabled signup errors are shown as useful fixed messages without raw SDK output. Fields are preserved after errors; successful session-less signup clears passwords.

## Confirmation and return links

Registration requests an email redirect to the current origin's `/pages/login/?next=...`. In Supabase Dashboard → Authentication → URL Configuration, add each actual development/production login callback URL/origin to the redirect allowlist and set the real production Site URL. Never invent a deployment URL. This task did not change the project's Site URL, redirect allowlist, email templates, SMTP settings or confirmation policy. The allowlist could not be inspected through the available public settings endpoint. Supabase may fall back to its configured Site URL if the requested redirect is not allowed.

The existing SDK's implicit email-confirmation callback handling establishes the session. The login page verifies the user before continuing to the selected page and clears callback fragments after processing. An expired/invalid link gets a safe error. Existing logged-in visitors see a Continue action instead of accidentally creating another account.

Login/register links retain a validated `next` return URL, including booking dates, guests, room type and observed quote. Return paths must match known local application pages; external origins, protocol-relative URLs, backslashes/control characters, unknown routes and login/register loops are rejected. The fallback is `/hotels/`. Passwords are never placed in URLs, logs or source configuration.

## Shared navigation and sessions

Page composition now observes Supabase auth events and injects verified state into the shared header. SDK callbacks schedule `getUser` outside the Auth lock, and sequence checks ignore outdated verification results. Session values alone do not grant authenticated navigation. The existing client persists/refreshes its session using the SDK's browser storage behavior. Header state updates after login, logout, refresh and cross-tab SDK events. Admin navigation remains hidden; no browser self-promotion or role-writing path exists.

Verified users see My Bookings, Account and Logout. Logout uses `signOut({ scope: 'local' })`, clears the current browser session through the SDK and returns to Login. Failures use the shared toast. My Bookings and Account remain placeholders. Booking submission was subsequently implemented in the [booking milestone](booking-pages.md); UI visibility never substitutes for database authorization.

## Checks actually performed

- Five short Node tests cover internal return links, registration validation, sanitized errors, signup metadata without roles, email-confirmation gating, identity verification, Auth errors and local logout.
- Production build and diff review.
- Live publishable-key sign-in with an existing seeded guest, `getUser`, own-profile read with guest isolation, guest-role read, session restoration in a new SDK client using shared in-memory storage, logout, absent identity after logout and incorrect-password rejection all passed. No new account, email, password reset or profile update was performed by these checks.

No Playwright, browser reload/cross-tab UI checks or real signup/email delivery/confirmation-click tests were run. Signup session and no-session paths were tested with an SDK double. Real email delivery depends on the project's mail provider and configured redirects.

Official API references checked for the installed Supabase JS 2.118-compatible APIs: [signUp](https://supabase.com/docs/reference/javascript/auth-signup), [signInWithPassword](https://supabase.com/docs/reference/javascript/auth-signinwithpassword), [getUser](https://supabase.com/docs/reference/javascript/auth-getuser), [auth events](https://supabase.com/docs/reference/javascript/auth-onauthstatechange), [signOut](https://supabase.com/docs/reference/javascript/auth-signout).
