import { test } from 'node:test';
import assert from 'node:assert/strict';
import { catalog, configuration, futureDate, marker, seed } from './seed-demo.mjs';

const config = { adminEmail: 'admin@example.invalid', guestPassword: 'test-only-password', adminPassword: 'test-only-password', dryRun: false };
function mock() {
  const tables = Object.fromEntries(['user_roles', 'hotels', 'room_types', 'rooms', 'bookings'].map(name => [name, []]));
  const users = []; let writes = 0;
  const client = {
    auth: { admin: {
      async listUsers({ page, perPage }) { return { data: { users: users.slice((page - 1) * perPage, page * perPage) } }; },
      async createUser(attributes) {
        writes++; assert.equal(attributes.email_confirm, true);
        const user = { ...attributes, id: `user-${users.length}` }; users.push(user);
        tables.user_roles.push({ user_id: user.id, role: 'guest' }); return { data: { user } };
      },
    } },
    from(name) {
      let filters = []; let operation = 'select'; let value;
      const query = {
        select() { return query; }, eq(key, expected) { filters.push([key, expected]); return query; },
        maybeSingle() { return query; }, single() { return query; },
        insert(row) { operation = 'insert'; value = row; return query; },
        update(row) { operation = 'update'; value = row; return query; },
        then(resolve, reject) {
          return Promise.resolve().then(() => {
            const row = tables[name].find(item => filters.every(([key, expected]) => item[key] === expected));
            if (operation === 'insert') { writes++; tables[name].push({ ...value }); }
            if (operation === 'update') { writes++; Object.assign(row, value); }
            return { data: row ?? null };
          }).then(resolve, reject);
        },
      }; return query;
    },
  };
  return { client, tables, users, writes: () => writes };
}
test('dry run performs no writes and reports plans separately', async () => {
  const db = mock(); const result = await seed(db.client, { ...config, dryRun: true });
  assert.equal(db.writes(), 0); assert.equal(result.accounts.created, 0);
  assert.equal(result.bookings.wouldCreate, 27); assert.equal(result.roles.wouldPromote, 1);
});
test('execution, rerun, preserved bookings and exactly one admin', async () => {
  const db = mock(); const first = await seed(db.client, config);
  assert.equal(first.accounts.created, 4); assert.equal(first.hotels.created, 3);
  assert.equal(first.room_types.created, 9); assert.equal(first.rooms.created, 27);
  assert.equal(first.bookings.created, 27);
  assert.equal(db.tables.user_roles.filter(row => row.role === 'admin').length, 1);
  db.tables.bookings[0].status = 'cancelled';
  const writes = db.writes(); const second = await seed(db.client, config);
  assert.equal(second.bookings.skipped, 27); assert.equal(db.writes(), writes);
  assert.equal(db.tables.bookings[0].status, 'cancelled');
});
test('unrelated account and changed admin fail before writes', async () => {
  const db = mock(); db.users.push({ email: 'guest1@example.invalid', app_metadata: {} });
  await assert.rejects(seed(db.client, config), /unrelated/); assert.equal(db.writes(), 0);
  db.users.splice(0, 1, { email: 'previous@example.invalid', app_metadata: { demo_seed: marker, demo_admin: true } });
  await assert.rejects(seed(db.client, config), /different admin/); assert.equal(db.writes(), 0);
});
test('conflicting catalog data is never overwritten', async () => {
  const db = mock(); db.tables.hotels.push({ ...catalog().hotels[0], name: 'Unrelated changed hotel' });
  await assert.rejects(seed(db.client, config), /conflicts/);
  assert.equal(db.tables.hotels[0].name, 'Unrelated changed hotel');
});
test('calendar uses Sofia even across UTC day and year boundaries', () => {
  assert.equal(futureDate(1, new Date('2026-12-31T23:30:00Z')), '2027-01-02');
});
test('project confirmation, safe addresses and explicit mode are required', () => {
  const env = { DEMO_PROJECT_REF: 'a'.repeat(20), DEMO_CONFIRM_PROJECT_REF: 'a'.repeat(20),
    DEMO_SUPABASE_SECRET_KEY: 'sb_secret_test_only', DEMO_ADMIN_EMAIL: config.adminEmail,
    DEMO_GUEST_PASSWORD: config.guestPassword, DEMO_ADMIN_PASSWORD: config.adminPassword };
  assert.equal(configuration(env, ['--dry-run']).dryRun, true);
  assert.throws(() => configuration({ ...env, DEMO_CONFIRM_PROJECT_REF: 'b'.repeat(20) }, ['--execute']));
  assert.throws(() => configuration({ ...env, DEMO_ADMIN_EMAIL: 'admin@real.example' }, ['--execute']));
  assert.throws(() => configuration(env, []));
});
