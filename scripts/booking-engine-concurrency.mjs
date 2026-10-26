import assert from 'node:assert/strict';

const user1 = '10000000-0000-0000-0000-000000000001';
const user2 = '10000000-0000-0000-0000-000000000002';
const type = (n) => `72000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const request = (n) => `75000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const asUser = (user, sql) => `set role authenticated; set request.jwt.claim.sub='${user}'; ${sql}`;
const create = (typeId, requestId, offset = 40, guests = 1) => `select public.create_booking('${typeId}',
  (clock_timestamp() at time zone 'UTC')::date+${100+offset},
  (clock_timestamp() at time zone 'UTC')::date+${101+offset},${guests},
  'Concurrent guest','Test phone','','${requestId}',99.99,99.99);`;
const response = (result) => {
  assert.equal(result.code, 0, result.stderr);
  const json = result.stdout.split(/\r?\n/).find((line) => line.startsWith('{'));
  assert.ok(json, result.stdout);
  return JSON.parse(json);
};
function ready(child) {
  return new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => reject(new Error('Test transaction did not become ready')), 10000);
    child.stdout.on('data', (chunk) => {
      output += chunk;
      if (output.includes('ENGINE_READY')) { clearTimeout(timeout); resolve(); }
    });
    child.on('close', () => {
      if (!output.includes('ENGINE_READY')) { clearTimeout(timeout); reject(new Error('Holder exited before readiness')); }
    });
  });
}

export async function verifyBookingConcurrency({ query, mustQuery }) {
  async function hold(sql, seconds = 1) {
    const operation = query(`begin; ${sql} select 'ENGINE_READY'; select pg_sleep(${seconds}); commit;`);
    await ready(operation.child);
    return operation;
  }
  // Two rooms can be allocated without both callers claiming the same room.
  const first = await hold(asUser(user1, create(type(7), request(1))));
  const second = query(asUser(user2, create(type(7), request(2))));
  const [a, b] = await Promise.all([first.done, second.done]);
  assert.equal(response(a).outcome, 'confirmed');
  assert.equal(response(b).outcome, 'confirmed');
  assert.equal((await mustQuery(`select count(distinct room_id) from public.bookings where request_id in ('${request(1)}','${request(2)}');`)).trim(), '2');
  console.log('PASS: competing requests allocate two distinct rooms.');

  // Duplicate submissions serialize on the per-user request ledger.
  const duplicate1 = await hold(asUser(user1, create(type(7), request(3), 50)));
  const duplicate2 = query(asUser(user1, create(type(7), request(3), 50)));
  const [d1, d2] = await Promise.all([duplicate1.done, duplicate2.done]);
  assert.equal(response(d1).booking.id, response(d2).booking.id);
  assert.equal(response(d2).replayed, true);
  assert.equal((await mustQuery(`select count(*) from public.bookings where request_id='${request(3)}';`)).trim(), '1');
  console.log('PASS: simultaneous identical requests create one reservation.');

  const mismatch1 = await hold(asUser(user1, create(type(7), request(4), 60)));
  const mismatch2 = query(asUser(user1, create(type(7), request(4), 60, 2)));
  const [m1, m2] = await Promise.all([mismatch1.done, mismatch2.done]);
  assert.equal(response(m1).outcome, 'confirmed');
  assert.notEqual(m2.code, 0);
  assert.match(m2.stderr, /22023/);
  console.log('PASS: simultaneous mismatched request-ID reuse is rejected.');

  // A locked but uncommitted reservation is contention, not a double-booking opportunity.
  const single1 = await hold(asUser(user1, create(type(8), request(5))));
  const busy = response(await query(asUser(user2, create(type(8), request(6)))).done);
  assert.equal(busy.outcome, 'retryable_busy');
  assert.equal(response(await single1.done).outcome, 'confirmed');
  const unavailable = response(await query(asUser(user2, create(type(8), request(6)))).done);
  assert.equal(unavailable.outcome, 'unavailable');
  console.log('PASS: last-room contention is bounded and a retry observes committed availability.');

  // Lock inventory without consuming it, then retry the same fingerprint after release.
  const lock = await hold(`select id from public.rooms where room_type_id='${type(8)}' for update;`);
  assert.equal(response(await query(asUser(user2, create(type(8), request(7), 70))).done).outcome, 'retryable_busy');
  const changed = await query(asUser(user2, create(type(8), request(7), 70, 2))).done;
  assert.notEqual(changed.code, 0);
  assert.match(changed.stderr, /22023/);
  assert.equal((await lock.done).code, 0);
  assert.equal(response(await query(asUser(user2, create(type(8), request(7), 70))).done).outcome, 'confirmed');
  console.log('PASS: transient busy permits identical retries but rejects changed payloads.');

  const catalogLock = await hold(`update public.room_types set description='Locked test catalog' where id='${type(8)}';`, 3);
  assert.equal(response(await query(asUser(user2, create(type(8), request(9), 75))).done).outcome, 'retryable_busy');
  const lockedMismatch = await query(asUser(user2, create(type(8), request(9), 75, 2))).done;
  assert.notEqual(lockedMismatch.code, 0);
  assert.match(lockedMismatch.stderr, /22023/);
  assert.equal((await catalogLock.done).code, 0);
  assert.equal(response(await query(asUser(user2, create(type(8), request(9), 75))).done).outcome, 'confirmed');
  console.log('PASS: bounded catalog lock timeouts preserve request identity for safe retries.');

  const id = response(d1).booking.id;
  const cancel1 = await hold(asUser(user1, `select public.cancel_booking('${id}');`));
  const cancel2 = query(asUser(user1, `select public.cancel_booking('${id}');`));
  const [c1,c2] = await Promise.all([cancel1.done,cancel2.done]);
  assert.equal(response(c1).replayed, false);
  assert.equal(response(c2).replayed, true);
  assert.equal((await mustQuery(`select count(*) from public.booking_events where booking_id='${id}' and event_type='cancelled';`)).trim(), '1');
  console.log('PASS: competing cancellations append one cancellation event.');

  const price = await hold(`update public.room_types set nightly_rate=100.01 where id='${type(7)}';`);
  const quote = query(asUser(user1, create(type(7), request(8), 80)));
  assert.equal((await price.done).code, 0);
  const quoted = response(await quote.done);
  assert.equal(quoted.outcome, 're_quote');
  assert.equal(quoted.quote.total_price, 100.01);
  assert.equal((await mustQuery(`select count(*) from public.bookings where request_id='${request(8)}';`)).trim(), '0');
  console.log('PASS: concurrent catalog changes trigger a re-quote before any reservation is saved.');
}
