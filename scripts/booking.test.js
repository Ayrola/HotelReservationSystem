import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBookingAttempt} from '../src/services/booking-attempt.js';
import {bookingPayload,validateBookingGuest,readBookingSelection,restoreBookingAttempt} from '../src/utils/booking.js';
const id='12345678-1234-4234-a234-123456789abc';
const values={roomTypeId:id,checkIn:'2030-01-01',checkOut:'2030-01-04',guests:'2'};
const payload=bookingPayload(values,{nightly_rate:'75.00',total_price:'225.00'},{guestName:'Guest',phone:'',specialRequests:''});
test('optional phone, calendar inputs and payload exclude owner and URL prices',()=>{
  assert.deepEqual(validateBookingGuest({guestName:'Guest',phone:'',specialRequests:''}),{});
  assert.ok(validateBookingGuest({guestName:'',phone:'x'.repeat(41),specialRequests:''}).phone);
  assert.deepEqual(readBookingSelection(new URLSearchParams({...values,userId:id,totalPrice:'0'}).toString()).errors,{});
  assert.equal(Object.hasOwn(payload,'user_id'),false);
  assert.equal(payload.p_expected_total_price,'225.00');
  const saved=restoreBookingAttempt(JSON.stringify({id,payload:{...payload,p_user_id:'spoofed'},review:{}}));
  assert.equal(Object.hasOwn(saved.payload,'p_user_id'),false);
});
test('duplicate submits share one in-flight request and request UUID',async()=>{
  let calls=0;let ids=0;let resolve;
  const manager=createBookingAttempt({uuid:()=>{ids++;return id;},persist:()=>{},clear:()=>{},reconcile:async()=>null,
    create:()=>{calls++;return new Promise(done=>{resolve=done;});}});
  const first=manager.submit(payload,{});const second=manager.submit(payload,{});
  assert.equal(first,second);assert.equal(ids,1);assert.equal(calls,1);
  resolve({outcome:'confirmed',booking:{id,status:'confirmed'}});await first;
  assert.equal(manager.pending,null);
});
test('lost response reconciles the committed booking without a second mutation',async()=>{
  let calls=0;
  const manager=createBookingAttempt({uuid:()=>id,persist:()=>{},clear:()=>{},
    create:async()=>{calls++;throw new Error('lost response');},reconcile:async()=>({id,status:'confirmed'})});
  const result=await manager.submit(payload,{});
  assert.equal(result.outcome,'confirmed');assert.equal(result.replayed,true);assert.equal(calls,1);
});
test('unknown outcome reconciles before identical replay and ignores changed client values',async()=>{
  const events=[];let calls=0;let uuidCalls=0;
  const manager=createBookingAttempt({uuid:()=>{uuidCalls++;return id;},persist:()=>{},clear:()=>{},
    reconcile:async()=>{events.push('lookup');return null;},create:async(p,key)=>{
      events.push('create');calls++;assert.deepEqual(p,payload);assert.equal(key,id);
      if(calls===1) throw new Error('timeout'); return {outcome:'confirmed',booking:{id,status:'confirmed'}};
    }});
  assert.equal((await manager.submit(payload,{})).outcome,'uncertain');
  assert.ok(manager.pending);
  await manager.submit({...payload,p_guest_name:'Changed'},{});
  assert.deepEqual(events,['create','lookup','lookup','create']);assert.equal(uuidCalls,1);
});
test('re-quote starts a new attempt; busy preserves identity; storage failure sends nothing',async()=>{
  let ids=0;let mode='re_quote';let calls=0;
  const manager=createBookingAttempt({uuid:()=>String(++ids),persist:()=>{},clear:()=>{},reconcile:async()=>null,
    create:async()=>{calls++;return {outcome:mode};}});
  await manager.submit(payload,{});assert.equal(manager.pending,null);
  mode='retryable_busy';await manager.submit(payload,{});await manager.submit(payload,{});
  assert.equal(ids,2);assert.equal(calls,3);
  const blocked=createBookingAttempt({uuid:()=>id,persist:()=>{throw new Error('storage unavailable');},create:async()=>{throw new Error('must not send');}});
  await assert.rejects(blocked.submit(payload,{}),/storage unavailable/);assert.equal(blocked.pending,null);
});
test('restored cancelled booking resolves without creating a replacement',async()=>{
  let creates=0;
  const manager=createBookingAttempt({initial:{id,payload,review:{}},persist:()=>{},clear:()=>{},uuid:()=>{throw new Error('must reuse');},
    create:async()=>{creates++;},reconcile:async()=>({id,status:'cancelled'})});
  const result=await manager.submit();
  assert.equal(result.outcome,'cancelled');assert.equal(creates,0);assert.equal(manager.pending,null);
});
