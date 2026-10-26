import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readHotelDetails,validateDetailSelection,createRequestGuard,eligibleRoomType,bookingDestination } from '../src/utils/hotel-details.js';
const id='12345678-1234-4234-a234-123456789abc';
const values={checkIn:'2030-03-30',checkOut:'2030-04-02',guests:'2'};
test('hotel IDs and duplicate selections are checked', () => {
  assert.equal(readHotelDetails('?id='+id).validId,true);
  for (const search of ['', '?id=<script>',`?id=${id}&id=${id}`]) assert.equal(readHotelDetails(search).validId,false);
  assert.equal(readHotelDetails(`?id=${id}&guests=1&guests=2`).duplicateSelection,true);
  assert.ok(readHotelDetails(`?id=${id}&checkIn=invalid`).errors.checkIn);
  assert.deepEqual(validateDetailSelection({checkIn:'',checkOut:'',guests:'2'}),{});
  assert.ok(validateDetailSelection({...values,checkOut:''}).checkOut);
});
test('late response is ignored after a newer selection even if newer request fails', async () => {
  const guard=createRequestGuard(); let complete;
  const old=guard.invalidate(); const pending=new Promise(resolve=>{complete=resolve;});
  const stale=pending.then(()=>guard.current(old));
  const next=guard.invalidate(); complete();
  assert.equal(await stale,false); assert.equal(guard.current(next),true);
});
test('Reserve eligibility requires current inventory and suitable capacity', () => {
  const type={id,capacity:2}; const quote={room_type_id:id,available_rooms:1};
  assert.equal(eligibleRoomType(type,quote,values),true);
  assert.equal(eligibleRoomType(type,{...quote,available_rooms:0},values),false);
  assert.equal(eligibleRoomType(type,quote,{...values,guests:'3'}),false);
  assert.equal(eligibleRoomType(type,undefined,values),false);
});
test('login return URL retains room type, dates, guests and observed quote', () => {
  const quote={nightly_rate:'75.00',total_price:'225.00'};
  const login=new URL(bookingDestination(id,id,values,quote,false),'https://example.invalid');
  const booking=new URL(login.searchParams.get('next'),login);
  assert.equal(booking.searchParams.get('checkIn'),values.checkIn);
  assert.equal(booking.searchParams.get('roomTypeId'),id);
  assert.equal(booking.searchParams.get('guests'),'2');
  assert.equal(booking.searchParams.get('expectedTotalPrice'),'225.00');
  assert.equal(bookingDestination(id,id,values,quote,true),booking.pathname+booking.search);
});
