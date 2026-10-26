import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { pages } from '../../src/pages/entries.js';

test('all pages mount the shared public shell without browser errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const entry of pages) {
    await page.goto(entry.path);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link')).toHaveText(['staywell', 'Home', 'Hotels', 'Login', 'Register']);
    await expect(page.locator('a[href*="/admin"]')).toHaveCount(0);
    await expect(page.locator('body > #toast-container')).toHaveCount(1);
    await expect(page.locator('#toast-container')).toHaveCount(1);
    await expect(page.locator('footer')).toHaveCount(1);
  }
  expect(errors).toEqual([]);
});

test('mobile menu supports keyboard, Escape and real navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const toggle = page.locator('button[aria-controls="primary-navigation"]');
  await expect(page.getByRole('link', { name: 'Hotels', exact: true })).toBeHidden();
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Home', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await page.getByRole('link', { name: 'Hotels', exact: true }).click();
  await expect(page).toHaveURL(/\/pages\/hotels\/$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('confirmation dialog contains focus, cancels safely and restores focus', async ({ page }) => {
  await page.goto('/');
  const opener = page.getByRole('button', { name: 'Preview confirmation dialog' });
  await opener.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toHaveAccessibleName('Preview this confirmation?');
  await expect(page.getByRole('button', { name: 'Close preview', exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Confirm preview', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  await opener.click();
  await page.getByRole('button', { name: 'Confirm preview', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  await expect(page.locator('.app-toast')).toContainText('No data was changed');
});

test('validation describes errors and toast is a single body child at top right', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Check example field' }).click();
  const email = page.getByRole('textbox', { name: 'Email address (required)' });
  await expect(email).toBeFocused();
  await expect(email).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('alert')).toContainText('Please correct 1 field');
  await expect(email).toHaveAccessibleDescription(/Please complete this field/);
  await email.fill('wrong');
  await page.getByRole('button', { name: 'Check example field' }).click();
  await expect(email).toHaveAttribute('aria-invalid', 'true');
  await email.fill('guest@example.com');
  await page.getByRole('button', { name: 'Check example field' }).click();
  await expect(page.getByRole('alert')).toBeHidden();
  await page.getByRole('button', { name: 'Preview notification' }).click();
  await expect(page.locator('body > #toast-container')).toHaveCount(1);
  await expect(page.locator('.app-toast')).toHaveCount(2);
  const position = await page.locator('#toast-container').evaluate((node) => {
    const style = getComputedStyle(node);
    return { position: style.position, top: style.top, right: style.right };
  });
  expect(position).toEqual({ position: 'fixed', top: '16px', right: '16px' });
  await page.getByRole('button', { name: 'Dismiss notification' }).first().click();
  await expect(page.locator('.app-toast')).toHaveCount(1);
});

test('selected query content is text and never executable markup', async ({ page }) => {
  await page.goto('/pages/hotel/?id=%3Cimg%20src=x%20onerror=alert(1)%3E');
  await expect(page.locator('#selection-context dd')).toHaveText('<img src=x onerror=alert(1)>');
  await expect(page.locator('#selection-context img')).toHaveCount(0);
});

test('desktop and mobile pass automated accessibility checks and show loaded photography', async ({ page }, testInfo) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    await page.locator('.hotel-card').last().scrollIntoViewIfNeeded();
    await expect.poll(() => page.locator('img').evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0))).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(result.violations).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`home-${width}.png`), fullPage: true });
  }
});

test('reduced motion disables skeleton animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  expect(await page.locator('.skeleton').first().evaluate((node) => getComputedStyle(node).animationName)).toBe('none');
});
