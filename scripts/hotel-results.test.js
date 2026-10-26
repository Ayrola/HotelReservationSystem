import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readHotelResults, hotelResultsUrl, hotelResultDetailsUrl } from '../src/utils/hotel-results.js';
test('undated browsing and dated search parse with safe defaults', () => {
  assert.deepEqual(readHotelResults('').errors, {});
  const parsed = readHotelResults('?destination=Sofia&checkIn=2030-01-01&checkOut=2030-01-31&guests=3&maxPrice=90.50&sort=name_desc&page=2');
  assert.deepEqual(parsed.errors, {});
  const next = new URL(hotelResultsUrl(parsed.values,'3'),'https://example.invalid');
  assert.equal(next.searchParams.get('page'),'3');
  assert.equal(next.searchParams.get('checkIn'),'2030-01-01');
  assert.equal(next.searchParams.get('maxPrice'),'90.50');
  const details = new URL(hotelResultDetailsUrl('hotel-1',parsed.values),next);
  assert.equal(details.searchParams.get('guests'),'3');
  assert.equal(details.searchParams.get('destination'),'Sofia');
  assert.equal(details.searchParams.get('page'),'2');
});
test('malformed URL filters and partial dates are rejected before requests', () => {
  for (const query of ['?checkIn=2030-01-01','?guests=0','?guests=2147483648','?page=-1','?page=1000001','?sort=invalid','?maxPrice=-1','?maxPrice=NaN','?maxPrice=1.234','?guests=2&guests=3']) {
    assert.ok(Object.keys(readHotelResults(query).errors).length,query);
  }
});
