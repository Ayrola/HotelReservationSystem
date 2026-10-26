import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';

export const marker = 'hotel-demo-v1';
class SeedError extends Error {}
export function seedId(key) {
  const hex = createHash('sha256').update(`${marker}:${key}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
export function configuration(env, args) {
  if (args.some(arg => !['--dry-run', '--execute'].includes(arg)) || args.length !== 1) {
    throw new SeedError('Specify exactly one of --dry-run or --execute.');
  }
  const ref = env.DEMO_PROJECT_REF;
  if (!/^[a-z]{20}$/.test(ref ?? '') || env.DEMO_CONFIRM_PROJECT_REF !== ref) {
    throw new SeedError('Set matching DEMO_PROJECT_REF and DEMO_CONFIRM_PROJECT_REF for the intended project.');
  }
  const url = `https://${ref}.supabase.co`;
  const key = env.DEMO_SUPABASE_SECRET_KEY;
  if (!key || key.trim() !== key) throw new SeedError('Set DEMO_SUPABASE_SECRET_KEY in the server environment.');
  if (!key.startsWith('sb_secret_')) {
    let payload;
    try { payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()); } catch { /* rejected below */ }
    if (payload?.role !== 'service_role' || payload.ref !== ref) throw new SeedError('A matching service-role JWT or secret key is required.');
  }
  const adminEmail = env.DEMO_ADMIN_EMAIL?.toLowerCase();
  if (!/^[a-z0-9._+-]+@example\.invalid$/.test(adminEmail ?? '') || adminEmail.startsWith('guest')) {
    throw new SeedError('DEMO_ADMIN_EMAIL must be an explicit non-guest address at example.invalid.');
  }
  for (const name of ['DEMO_GUEST_PASSWORD', 'DEMO_ADMIN_PASSWORD']) {
    if ((env[name]?.length ?? 0) < 6) throw new SeedError(`${name} must contain at least 6 characters. The project's Auth password policy also applies.`);
  }
  return { url, key, adminEmail, guestPassword: env.DEMO_GUEST_PASSWORD,
    adminPassword: env.DEMO_ADMIN_PASSWORD, dryRun: args[0] === '--dry-run' };
}

export function catalog() {
  const hotels = []; const room_types = []; const rooms = [];
  for (const [index, city] of ['Sofia', 'Plovdiv', 'Bansko'].entries()) {
    const id = seedId(`hotel:${index}`);
    hotels.push({ id, name: ['Demo Vitosha Lantern', 'Demo Maritsa Courtyard', 'Demo Pirin Hideaway'][index],
      description: 'Fictional demonstration hotel. Images are illustrative local assets.', city,
      country: 'Bulgaria', address: `Fictional Demo Lane ${index + 1}`, timezone: 'Europe/Sofia', is_active: true });
    for (const [type, capacity] of [1, 2, 4].entries()) {
      const room_type_id = seedId(`type:${index}:${type}`);
      room_types.push({ id: room_type_id, hotel_id: id, name: ['Solo', 'Double', 'Family'][type],
        capacity, nightly_rate: 45 + index * 15 + type * 30, currency: 'EUR', is_active: true });
      for (let number = 1; number <= 3; number++) rooms.push({ id: seedId(`room:${index}:${type}:${number}`),
        room_type_id, hotel_id: id, room_number: `${type + 1}0${number}`, is_active: true });
    }
  }
  return { hotels, room_types, rooms };
}
export function futureDate(offset, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Sofia', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = name => parts.find(item => item.type === name).value;
  const date = new Date(`${part('year')}-${part('month')}-${part('day')}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

export async function seed(client, config, counts = {}) {
  const count = (kind, action) => {
    counts[kind] ??= { created: 0, skipped: 0, wouldCreate: 0, promoted: 0, wouldPromote: 0 };
    counts[kind][action]++;
  };
  async function checked(query, operation) {
    const { data, error } = await query;
    if (error) throw new SeedError(`${operation} failed (code ${/^[A-Za-z0-9_]+$/.test(error.code ?? '') ? error.code : 'unavailable'}).`);
    return data;
  }
  // Read every Auth page before creating anything. Never adopt unrelated users.
  const users = [];
  for (let page = 1; ; page++) {
    const data = await checked(client.auth.admin.listUsers({ page, perPage: 100 }), 'Auth inventory');
    users.push(...data.users);
    if (data.users.length < 100) break;
  }
  const accounts = ['guest1@example.invalid', 'guest2@example.invalid', 'guest3@example.invalid', config.adminEmail];
  if (users.some(user => user.app_metadata?.demo_seed === marker && user.app_metadata?.demo_admin === true && user.email?.toLowerCase() !== config.adminEmail)) {
    throw new SeedError('A different admin was configured for this seed; preserve the original DEMO_ADMIN_EMAIL.');
  }
  for (const email of accounts) {
    const existing = users.find(user => user.email?.toLowerCase() === email);
    if (existing && existing.app_metadata?.demo_seed !== marker) throw new SeedError('An intended demo address belongs to an unrelated account; stopped.');
  }
  const identities = [];
  for (const email of accounts) {
    let user = users.find(item => item.email?.toLowerCase() === email);
    if (user) count('accounts', 'skipped');
    else if (config.dryRun) { count('accounts', 'wouldCreate'); user = { id: seedId(email) }; }
    else {
      const data = await checked(client.auth.admin.createUser({ email, email_confirm: true,
        password: email === config.adminEmail ? config.adminPassword : config.guestPassword,
        app_metadata: { demo_seed: marker, demo_admin: email === config.adminEmail }, user_metadata: { display_name: 'Demo account' } }), 'Auth creation');
      user = data.user; count('accounts', 'created');
    }
    identities.push(user.id);
    if (config.dryRun && !users.some(item => item.id === user.id)) {
      count('roles', email === config.adminEmail ? 'wouldPromote' : 'wouldCreate');
      continue;
    }
    const role = await checked(client.from('user_roles').select('role').eq('user_id', user.id).maybeSingle(), 'Role read');
    if (!role) throw new SeedError('Expected signup role is missing; stopped.');
    if (email !== config.adminEmail && role.role !== 'guest') throw new SeedError('A demo guest has an unexpected elevated role; stopped.');
    if (email === config.adminEmail && role.role !== 'admin') {
      if (config.dryRun) count('roles', 'wouldPromote');
      else { await checked(client.from('user_roles').update({ role: 'admin' }).eq('user_id', user.id).eq('role', 'guest').select().single(), 'Admin provisioning'); count('roles', 'promoted'); }
    } else count('roles', 'skipped');
  }
  async function insertMissing(table, row) {
    const existing = await checked(client.from(table).select('*').eq('id', row.id).maybeSingle(), `${table} read`);
    if (existing) {
      const keys = table === 'bookings' ? ['user_id', 'room_id', 'request_id'] : Object.keys(row);
      if (keys.some(key => String(existing[key]) !== String(row[key]))) throw new SeedError(`${table} seed identity conflicts with existing data; stopped without overwriting it.`);
      count(table, 'skipped'); return;
    }
    if (config.dryRun) count(table, 'wouldCreate');
    else { await checked(client.from(table).insert(row), `${table} insert`); count(table, 'created'); }
  }
  const data = catalog();
  for (const table of ['hotels', 'room_types', 'rooms']) for (const row of data[table]) await insertMissing(table, row);
  // Fixed seed identities preserve historical bookings on reruns; dates only affect new rows.
  // Trusted system inserts retain database allocation exclusion, capacity, dates and snapshot triggers.
  for (const [index, room] of data.rooms.entries()) {
    await insertMissing('bookings', { id: seedId(`booking:${index}`), request_id: seedId(`request:${index}`),
      user_id: identities[index % 3], room_id: room.id, check_in: futureDate(14), check_out: futureDate(18),
      guest_count: 1, guest_name: 'Fictional demo guest', contact_phone: 'Demo contact unavailable',
      special_requests: 'Seeded demonstration reservation; pay at hotel.' });
  }
  return counts;
}

async function main() {
  const counts = {};
  try {
    const config = configuration(process.env, process.argv.slice(2));
    const client = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    console.log(config.dryRun ? 'Read-only dry run; created counts stay zero.' : 'Executing dedicated demo seed.');
    for (const name of ['hotel-exterior.jpg', 'hotel-room.jpg', 'hotel-pool.jpg']) {
      const present = existsSync(fileURLToPath(new URL(`../public/images/${name}`, import.meta.url)));
      console.log(`${present ? 'Local illustrative asset' : 'Missing asset; supply later'}: public/images/${name}`);
    }
    console.log('Storage upload and hotel_images rows deferred until a real bucket and policies exist.');
    await seed(client, config, counts);
  } catch (error) {
    // SDK/network errors may contain URLs or headers. Only our fixed messages are printable.
    const safe = error instanceof SeedError;
    console.error(safe ? error.message : 'Seed failed; credentials and raw service errors suppressed.');
    process.exitCode = 1;
  } finally { console.log(JSON.stringify(counts, null, 2)); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
