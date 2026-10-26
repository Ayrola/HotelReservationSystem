# Shared design system

Staywell is the interface name for the Hotel Booking System preview. The visual language uses warm neutral surfaces, dark forest-green accents, generous spacing, system body typography and serif headings. All hotel content and photography are clearly illustrative; no ratings, reviews, availability or sample prices are claimed.

## Structure

The home HTML entry stays at `/`. All other HTML entries now live in `pages/`, so their URLs start with `/pages/`. The existing per-page modules remain in `src/pages/`. `src/pages/entries.js` drives the Vite entry configuration and production checks.

Each page mounts shared header and footer components. Public navigation is Home, Hotels, Login and Register. Admin links are absent, including on admin placeholders. Keeping an admin URL accessible as a placeholder does not authorize future administrative operations.

## Components

| Module in src/components | Responsibility |
| --- | --- |
| header.js | Public navigation, mobile toggle, current-page marker and an injected authenticated variant |
| footer.js | Shared footer, public links and EUR/pay-at-hotel terms |
| layout.js | Labelled sections; `.page-container`, `.section-space`, `.showcase-grid` and `.card-grid` provide layouts |
| hotel-card.js | Illustrative or future real hotel content, photography and EUR price presentation |
| forms.js | Labelled inputs, help text, field errors and validation summary |
| states.js | Empty-state and loading skeleton factories |
| confirmation-dialog.js | Promise-based confirmation with native modal semantics and explicit keyboard focus containment |
| toast.js | Singleton body-level notification region and persistent, dismissible messages |
| design-preview.js | Clearly labelled examples, illustrative hotel collection and home hero |
| page.js | Shared styles, shell mounting and placeholder page composition |

Components use DOM construction and textContent for supplied text. They do not import database clients or services. The hotel-card image helper permits only HTTP(S) image URLs. Real database access remains a future service responsibility.

## Tokens and variants

`src/styles/tokens.css` defines semantic colour, font, type-scale, spacing, border, radius, shadow and container-width variables. `main.css` applies them to shared components and Bootstrap controls.

Use Bootstrap `.btn-primary`, `.btn-outline-primary`, `.btn-danger`, `.form-control`, `.form-select` and `.form-check` with the shared styles. Shared badge variants are `.badge-soft` and `.badge-surface`. Disabled actions must use the actual disabled attribute. Bootstrap Icons 1.13.2 is the sole icon library; decorative icons are hidden from assistive technology and icon-only controls require labels.

## Integration examples

```js
// Future authenticated shell: the application supplies verified state and a service callback.
createHeader({ authenticated: true, onLogout: handleLogout });

const field = createField({ id: 'email', label: 'Email address', type: 'email', required: true });
// Render field.wrapper. Before processing, use validateFields([field], summary).
// For service errors, use field.setError(message) and an error summary.

const accepted = await confirmAction({
  title: 'Confirm action',
  message: 'Explain the consequence here.',
  confirmLabel: 'Confirm',
  cancelLabel: 'Go back',
});
if (accepted) { /* The application performs its authorized operation. */ }

showToast('Explain the result.', { tone: 'info' });
showToast('Explain the error and recovery.', { tone: 'error' });
```

No authentication state is simulated. All pages currently mount the public header. The authenticated variant offers My Bookings, Account and Logout; Logout is disabled if no callback is supplied. There is deliberately no admin variant until role checking exists.

## Accessibility behaviour

- Mobile menu uses a real button, aria-expanded and aria-controls. Escape closes it and returns focus; focus leaving navigation also closes it.
- Native modal dialog makes the background inert, starts focus on the cancel button, contains Tab/Shift+Tab, supports Escape and restores focus to its opener. Only one confirmation can be active at once.
- `#toast-container` is mounted once as a direct child of document.body, fixed at top right. Individual messages use status or alert semantics and explicit dismiss buttons. They do not expire automatically or steal focus.
- Validation is tied to labels and descriptions, sets aria-invalid and focuses the first invalid field. A visible alert summary supplements inline errors. Forms never rely on colour alone.
- Focus outlines, responsive layouts and reduced-motion overrides apply throughout. Loading skeletons have nonvisual descriptions and are explicitly labelled examples in the preview.

## Verification

```sh
npm run build
npm run check:pages
npx playwright install chromium
npm run check:ui
```

Playwright uses production preview. Tests cover all 15 shells, public-only navigation, query escaping, mobile keyboard navigation, dialog focus/escape/confirmation, validation, singleton toast positioning and dismissal, loaded images, horizontal overflow and reduced motion. Axe checks the home page at desktop and mobile widths. These automated checks do not establish complete WCAG conformance or replace screen-reader evaluation. Screenshot artifacts are generated in ignored `test-results/`.

## Photography and references

Locally bundled illustrative images from Unsplash image endpoints:

- [Pool photograph](https://images.unsplash.com/photo-1566073771259-6a8506099945), saved as public/images/hotel-pool.jpg.
- [Room photograph](https://images.unsplash.com/photo-1611892440504-42a792e24d32), saved as public/images/hotel-room.jpg.
- [Exterior photograph](https://images.unsplash.com/photo-1542314831-068cd1dbfeeb), saved as public/images/hotel-exterior.jpg.

Implementation references: [Bootstrap 5.3 forms](https://getbootstrap.com/docs/5.3/forms/overview/), [validation accessibility guidance](https://getbootstrap.com/docs/5.3/forms/validation/), [Bootstrap Icons usage](https://icons.getbootstrap.com/usage/), and [MDN dialog semantics](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog).
