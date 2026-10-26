import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calendarDay, validateHotelSearch, searchParameters, hotelDetailsUrl } from '../src/utils/hotel-search.js';

const valid = { destination: 'София & sea', checkIn: '2030-03-30', checkOut: '2030-03-31', guests: '2' };
test('calendar strings survive URLs, leap years and daylight-saving boundaries', () => {
  assert.deepEqual(validateHotelSearch(valid), {});
  assert.equal(calendarDay('2030-04-01') - calendarDay('2030-03-30'), 2);
  assert.equal(calendarDay('2028-03-01') - calendarDay('2028-02-28'), 2);
  assert.equal(calendarDay('2029-02-29'), null);
  assert.equal(calendarDay('2030-02-31'), null);
  const url = new URL(`/hotels/?${searchParameters(valid)}`, 'https://example.invalid');
  assert.equal(url.searchParams.get('destination'), valid.destination);
  assert.equal(url.searchParams.get('checkIn'), valid.checkIn);
  const details = new URL(hotelDetailsUrl('id&injection', valid), url);
  assert.equal(details.searchParams.get('id'), 'id&injection');
  assert.equal(details.searchParams.get('checkOut'), valid.checkOut);
  assert.equal(details.searchParams.get('guests'), '2');
});
test('requires real dates, checkout after arrival and at most 30 nights', () => {
  for (const checkOut of ['', 'invalid', '2030-03-30', '2030-03-29', '2030-04-30']) {
    assert.ok(validateHotelSearch({ ...valid, checkOut }).checkOut);
  }
  assert.deepEqual(validateHotelSearch({ ...valid, checkOut: '2030-04-29' }), {});
});
test('guest count must be a safe positive whole integer', () => {
  for (const guests of ['', '0', '-1', '1.5', '1e2', 'Infinity', '9007199254740992']) assert.ok(validateHotelSearch({ ...valid, guests }).guests);
  assert.deepEqual(validateHotelSearch({ ...valid, guests: '1' }), {});
});
