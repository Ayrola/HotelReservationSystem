import { spawn, execFileSync } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { createServer } from 'node:net';
import assert from 'node:assert/strict';
import { verifyBookingConcurrency } from './booking-engine-concurrency.mjs';

// An isolated loopback-only PostgreSQL instance. Never connects to the remote project.
const bin = process.env.POSTGRES_BIN || (process.platform === 'win32' ? 'C:/Program Files/PostgreSQL/17/bin' : '');
const executable = (name) => bin ? join(bin, name + (process.platform === 'win32' ? '.exe' : '')) : name;
const root = await mkdtemp(join(tmpdir(), 'hotel-schema-test-'));
const data = join(root, 'data');
const listener = createServer();
await new Promise((resolve) => listener.listen(0, '127.0.0.1', resolve));
const port = listener.address().port;
await new Promise((resolve) => listener.close(resolve));
const base = ['-X', '-h', '127.0.0.1', '-p', String(port), '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-qAt'];
function query(sql) {
  const child = spawn(executable('psql'), base, { windowsHide: true, env: { ...process.env, PGCLIENTENCODING: 'UTF8', PGOPTIONS: '-c statement_timeout=15000' } });
  let stdout = '', stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const done = new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
  child.stdin.end(sql);
  return { child, done };
}
async function mustQuery(sql) {
  const result = await query(sql).done;
  assert.equal(result.code, 0, result.stderr);
  return result.stdout;
}
let started = false;
try {
  execFileSync(executable('initdb'), ['-D', data, '-U', 'postgres', '-A', 'trust', '--no-locale', '--encoding=UTF8'], { windowsHide: true, stdio: 'pipe' });
  execFileSync(executable('pg_ctl'), ['-D', data, '-l', join(root, 'postgres.log'), '-o', `-p ${port} -h 127.0.0.1`, '-w', 'start'], { windowsHide: true, stdio: 'ignore' });
  started = true;
  await mustQuery(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    insert into auth.users values ('10000000-0000-0000-0000-000000000001', '{"display_name":"Existing user","role":"admin"}');
  `);
  const directory = new URL('../supabase/migrations/', import.meta.url);
  for (const file of (await readdir(directory)).filter((file) => file.endsWith('.sql')).sort()) {
    await mustQuery(`begin;\n${await readFile(new URL(file, directory), 'utf8')}\ncommit;`);
    console.log(`PASS migration ${file}`);
    if (file.endsWith('_initial_hotel_schema.sql')) {
      const checks = await mustQuery(await readFile(new URL('../supabase/tests/initial_schema.sql', import.meta.url), 'utf8'));
      console.log(checks.split(/\r?\n/).filter((line) => line.startsWith('PASS:')).join('\n'));
    }
  }
  const engineChecks = await mustQuery(await readFile(new URL('../supabase/tests/booking_engine.sql', import.meta.url), 'utf8'));
  console.log(engineChecks.split(/\r?\n/).filter((line) => line.startsWith('PASS:')).join('\n'));
  await verifyBookingConcurrency({ query, mustQuery });
  const booking = (request) => `insert into public.bookings(user_id,room_id,check_in,check_out,guest_count,guest_name,contact_phone,request_id)
    values ('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','2040-01-01','2040-01-03',1,'Test guest','test phone','${request}');`;
  const first = query(`begin; ${booking('40000000-0000-0000-0000-000000000001')} select 'CONCURRENCY_READY'; select pg_sleep(2); commit;`);
  const ready = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Concurrent insert did not become ready')), 10000);
    first.child.stdout.on('data', (chunk) => {
      if (String(chunk).includes('CONCURRENCY_READY')) { clearTimeout(timeout); resolve(); }
    });
  });
  await ready;
  const second = query(booking('40000000-0000-0000-0000-000000000002'));
  const [one, two] = await Promise.all([first.done, second.done]);
  assert.equal(one.code, 0, one.stderr);
  assert.notEqual(two.code, 0);
  assert.match(two.stderr, /23P01/);
  console.log('PASS: competing transactions cannot reserve the same room for overlapping dates.');
} finally {
  if (started) execFileSync(executable('pg_ctl'), ['-D', data, '-m', 'fast', '-w', 'stop'], { windowsHide: true, stdio: 'ignore' });
  const target = resolve(root);
  if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith('hotel-schema-test-')) throw new Error('Unexpected cleanup target');
  await rm(target, { recursive: true, force: true });
}
