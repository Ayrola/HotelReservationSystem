import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const hotel = { id: 'hotel-1', name: 'Test property <safe>', city: 'Sofia', country: 'Bulgaria',
  room_types: [{ nightly_rate: '90.00', currency: 'EUR', is_active: true }, { nightly_rate: '40.00', currency: 'EUR', is_active: false }], hotel_images: [] };

test('catalog, indicative pricing, safe text and detail selection preservation', async ({ page }) => {
  let request;
  await page.route('**/rest/v1/hotels?*', route => { request = new URL(route.request().url()); return route.fulfill({ json: [hotel] }); });
  await page.goto('/?checkIn=2030-03-30&checkOut=2030-04-02&guests=3');
  const card = page.locator('.hotel-card');
  await expect(card).toContainText('Test property <safe>');
  await expect(card).toContainText('Sofia, Bulgaria');
  await expect(card).toContainText('From €90.00 / night');
  await expect(card).toContainText('Indicative catalog price');
  await expect(card).toContainText('Property photo unavailable');
  expect(request.searchParams.get('is_active')).toBe('eq.true');
  expect(request.searchParams.get('limit')).toBe('3');
  const link = card.getByRole('link');
  await expect(link).toHaveAttribute('href', '/pages/hotel/?id=hotel-1&checkIn=2030-03-30&checkOut=2030-04-02&guests=3');
  await page.locator('#guests').fill('4');
  await expect(link).toHaveAttribute('href', /guests=4$/);
  await link.click();
  await expect(page).toHaveURL(/\/pages\/hotel\/\?id=hotel-1&checkIn=2030-03-30&checkOut=2030-04-02&guests=4/);
});

test('search preserves errors, enforces bounds and navigates to encoded /hotels/', async ({ page }) => {
  await page.route('**/rest/v1/hotels?*', route => route.fulfill({ json: [] }));
  await page.goto('/');
  await page.locator('#destination').fill('София & coast');
  await page.locator('#checkIn').fill('2030-03-30');
  await page.locator('#checkOut').fill('2030-03-30');
  await page.locator('#guests').fill('1.5');
  await page.getByRole('button', { name: 'Search hotels' }).click();
  await expect(page.locator('#checkOut')).toBeFocused();
  await expect(page.locator('#checkOut-error')).toHaveText('Check-out must be after check-in.');
  await expect(page.locator('#guests')).toHaveValue('1.5');
  await expect(page.locator('#destination')).toHaveValue('София & coast');
  await page.locator('#checkOut').fill('2030-04-30');
  await page.getByRole('button', { name: 'Search hotels' }).click();
  await expect(page.locator('#checkOut-error')).toContainText('1–30 nights');
  await page.locator('#checkOut').fill('2030-04-29');
  await page.locator('#guests').fill('2');
  await page.getByRole('button', { name: 'Search hotels' }).click();
  await expect(page).toHaveURL(/\/hotels\/\?/);
  const url = new URL(page.url());
  expect(url.searchParams.get('destination')).toBe('София & coast');
  expect(url.searchParams.get('checkIn')).toBe('2030-03-30');
  expect(url.searchParams.get('checkOut')).toBe('2030-04-29');
  await expect(page.locator('h1')).toHaveText('Hotels');
});

test('loading, failure, retry and empty state retain the search', async ({ page }) => {
  let fail = true;
  await page.route('**/rest/v1/hotels?*', async route => {
    await new Promise(resolve => setTimeout(resolve, 400));
    await route.fulfill(fail ? { status: 500, json: { message: 'Test service failure' } } : { json: [] });
  });
  await page.goto('/');
  await expect(page.locator('#featured-hotels')).toHaveAttribute('aria-busy', 'true');
  await page.locator('#destination').fill('Plovdiv');
  await page.getByRole('button', { name: 'Try loading hotels again' }).click();
  fail = false;
  await expect(page.locator('#featured-status')).toHaveText('No active hotels to show yet.');
  await expect(page.locator('#destination')).toHaveValue('Plovdiv');
});

test('shared hotel card shows a loaded cover and falls back on failed or unsafe images', async ({ page }) => {
  // Serve the actual component sources through test-only routes; production has no test entry.
  const cardSource = await readFile(new URL('../../src/components/hotel-card.js', import.meta.url), 'utf8');
  const domSource = await readFile(new URL('../../src/utils/dom.js', import.meta.url), 'utf8');
  await page.route('**/__test__/hotel-card.js', route => route.fulfill({ contentType: 'text/javascript', body: cardSource.replace('../utils/dom.js', '/__test__/dom.js') }));
  await page.route('**/__test__/dom.js', route => route.fulfill({ contentType: 'text/javascript', body: domSource }));
  await page.route('**/rest/v1/hotels?*', route => route.fulfill({ json: [] }));
  await page.route('**/broken-cover.jpg', route => route.abort());
  await page.goto('/');
  await expect(page.locator('#featured-status')).toHaveText('No active hotels to show yet.');
  await page.evaluate(async () => {
    const { createPublicHotelCard } = await import('/__test__/hotel-card.js');
    document.querySelector('#featured-hotels').replaceChildren(...[
      '/images/hotel-room.jpg', '/broken-cover.jpg', 'javascript:alert(1)',
    ].map((image, index) => createPublicHotelCard({ title: `Image fixture ${index}`, destination: 'Test destination',
      image, imageAlt: 'Test cover photograph', nightlyPrice: null, href: '/pages/hotel/?id=test' })));
  });
  const cards = page.locator('.hotel-card');
  await cards.last().scrollIntoViewIfNeeded();
  await expect(cards.first().locator('img')).toBeVisible();
  await expect.poll(() => cards.first().locator('img').evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
  await expect(cards.first().getByText('Property photo unavailable')).toBeHidden();
  for (const index of [1, 2]) {
    await expect(cards.nth(index).getByText('Property photo unavailable')).toBeVisible();
    await expect(cards.nth(index).locator('img')).toHaveCount(0);
  }
});
