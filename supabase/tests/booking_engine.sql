-- Local-only integration tests. Never apply this fixture script to the hosted project.
set timezone='UTC';
create function pg_temp.assert_true(value boolean, label text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'FAIL: %', label; end if; end; $$;
create function pg_temp.expect_error(statement text, expected text, label text) returns void language plpgsql as $$
declare actual text;
begin
  begin execute statement;
  exception when others then
    get stacked diagnostics actual = returned_sqlstate;
    if actual = expected then return; end if;
    raise exception 'FAIL: %, expected %, received % (%)', label, expected, actual, sqlerrm;
  end;
  raise exception 'FAIL: % did not fail', label;
end; $$;
create function pg_temp.engine_create(p_type uuid, p_start integer, p_end integer, p_guests integer,
  p_request uuid, p_rate numeric default 99.99, p_total numeric default null,
  p_name text default 'Engine guest', p_phone text default 'Test phone')
returns jsonb language sql volatile as $$
  select public.create_booking(p_type, (clock_timestamp() at time zone 'UTC')::date + 100 + p_start,
    (clock_timestamp() at time zone 'UTC')::date + 100 + p_end, p_guests,
    p_name, p_phone, '', p_request, p_rate, coalesce(p_total, p_rate * (p_end-p_start)));
$$;
create temp table engine_results(label text primary key, response jsonb);
grant select, insert, update on engine_results to anon, authenticated;

insert into public.hotels(id,name,city,country,address,timezone,is_active) values
 ('71000000-0000-0000-0000-000000000001','Engine active','Test','Test','Test','Pacific/Kiritimati',true),
 ('71000000-0000-0000-0000-000000000002','Engine hidden','Test','Test','Test','UTC',false),
 ('71000000-0000-0000-0000-000000000003','Engine west','Test','Test','Test','Pacific/Pago_Pago',true);
insert into public.room_types(id,hotel_id,name,capacity,nightly_rate,is_active) values
 ('72000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000001','Two rooms',2,99.99,true),
 ('72000000-0000-0000-0000-000000000002','71000000-0000-0000-0000-000000000001','Single room',2,99.99,true),
 ('72000000-0000-0000-0000-000000000003','71000000-0000-0000-0000-000000000001','Inactive type',2,99.99,false),
 ('72000000-0000-0000-0000-000000000004','71000000-0000-0000-0000-000000000002','Hidden hotel type',2,99.99,true),
 ('72000000-0000-0000-0000-000000000005','71000000-0000-0000-0000-000000000001','Inactive inventory',2,99.99,true),
 ('72000000-0000-0000-0000-000000000006','71000000-0000-0000-0000-000000000003','West room',2,99.99,true),
 ('72000000-0000-0000-0000-000000000007','71000000-0000-0000-0000-000000000001','Competing two rooms',2,99.99,true),
 ('72000000-0000-0000-0000-000000000008','71000000-0000-0000-0000-000000000001','Competing one room',2,99.99,true);
insert into public.rooms(id,room_type_id,room_number,is_active) values
 ('73000000-0000-0000-0000-000000000001','72000000-0000-0000-0000-000000000001','E101',true),
 ('73000000-0000-0000-0000-000000000002','72000000-0000-0000-0000-000000000001','E102',true),
 ('73000000-0000-0000-0000-000000000003','72000000-0000-0000-0000-000000000002','E201',true),
 ('73000000-0000-0000-0000-000000000004','72000000-0000-0000-0000-000000000003','E301',true),
 ('73000000-0000-0000-0000-000000000005','72000000-0000-0000-0000-000000000004','E401',true),
 ('73000000-0000-0000-0000-000000000006','72000000-0000-0000-0000-000000000005','E501',false),
 ('73000000-0000-0000-0000-000000000007','72000000-0000-0000-0000-000000000006','W101',true),
 ('73000000-0000-0000-0000-000000000008','72000000-0000-0000-0000-000000000007','E701',true),
 ('73000000-0000-0000-0000-000000000009','72000000-0000-0000-0000-000000000007','E702',true),
 ('73000000-0000-0000-0000-000000000010','72000000-0000-0000-0000-000000000008','E801',true);

set role anon;
select pg_temp.assert_true((select available_rooms=2 and nightly_rate=99.99 and total_price=299.97 and currency='EUR' and nights=3
  from public.get_availability(current_date+100,current_date+103,2,null,'72000000-0000-0000-0000-000000000001')), 'exact EUR quote and aggregate count');
select pg_temp.assert_true((select not (to_jsonb(a) ?| array['room_id','room_number','user_id','guest_name','bookings'])
  from public.get_availability(current_date+100,current_date+103,2,null,'72000000-0000-0000-0000-000000000001') a), 'availability has no private fields');
select pg_temp.assert_true((select count(*)=0 from public.get_availability(current_date+100,current_date+103,3,null,'72000000-0000-0000-0000-000000000001')), 'availability respects capacity');
select pg_temp.assert_true((select count(*)=0 from public.get_availability(current_date+100,current_date+103,1,null,'72000000-0000-0000-0000-000000000003')), 'inactive type hidden');
select pg_temp.assert_true((select count(*)=0 from public.get_availability(current_date+100,current_date+103,1,null,'72000000-0000-0000-0000-000000000004')), 'inactive hotel hidden');
select pg_temp.assert_true((select available_rooms=0 from public.get_availability(current_date+100,current_date+103,1,null,'72000000-0000-0000-0000-000000000005')), 'inactive rooms unavailable');
select pg_temp.expect_error('select * from public.get_availability(current_date,current_date,1)','22023','empty stay');
select pg_temp.expect_error('select * from public.get_availability(current_date,current_date+31,1)','22023','maximum stay');
select pg_temp.expect_error('select * from public.get_availability(null,current_date+1,1)','22023','missing date');
select pg_temp.expect_error($q$select * from public.get_availability(current_date,'infinity',1)$q$,'22023','infinite date');
select pg_temp.expect_error('select * from public.get_availability(current_date,current_date+1,0)','22023','invalid guests');
select pg_temp.expect_error($q$select pg_temp.engine_create('72000000-0000-0000-0000-000000000001',0,1,1,gen_random_uuid())$q$,'42501','anonymous booking forbidden');
select pg_temp.expect_error('select public.cancel_booking(gen_random_uuid())','42501','anonymous cancellation forbidden');
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub','',false);
select pg_temp.expect_error($q$select pg_temp.engine_create('72000000-0000-0000-0000-000000000001',0,1,1,gen_random_uuid())$q$,'42501','authenticated role without a user is insufficient');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
select pg_temp.assert_true(public.create_booking('21000000-0000-0000-0000-000000000001','2030-01-01','2030-01-03',2,
  'Test guest','Test phone','','60000000-0000-0000-0000-000000000001',100,200)#>>'{booking,status}'='cancelled','pre-migration booking keys are backfilled and replayable');
insert into engine_results values ('requote',pg_temp.engine_create('72000000-0000-0000-0000-000000000001',0,3,1,'74000000-0000-0000-0000-000000000001',0,0));
select pg_temp.assert_true((select response->>'outcome'='re_quote' and (response#>>'{quote,total_price}')::numeric=299.97 and not response ? 'booking' from engine_results where label='requote'), 'tampered quote is replaced without saving');
select pg_temp.assert_true((pg_temp.engine_create('72000000-0000-0000-0000-000000000001',0,3,1,'74000000-0000-0000-0000-000000000001',0,0)->>'replayed')::boolean, 'requote replay is idempotent');
select pg_temp.expect_error($q$select pg_temp.engine_create('72000000-0000-0000-0000-000000000001',0,3,1,'74000000-0000-0000-0000-000000000001',99.99,299.97)$q$,'22023','requote acceptance needs a new request ID');
select pg_temp.expect_error($q$select pg_temp.engine_create('72000000-0000-0000-0000-000000000001',0,3,3,gen_random_uuid())$q$,'22023','booking capacity enforced');
select pg_temp.expect_error($q$select pg_temp.engine_create('72000000-0000-0000-0000-000000000001',0,31,1,gen_random_uuid())$q$,'22023','booking maximum stay enforced');
select pg_temp.expect_error($q$select pg_temp.engine_create('72000000-0000-0000-0000-000000000001',0,1,1,gen_random_uuid(),99.991)$q$,'22023','fractional cents rejected');
select pg_temp.expect_error($q$select pg_temp.engine_create('72000000-0000-0000-0000-000000000001',0,1,1,gen_random_uuid(),'NaN')$q$,'22023','NaN quote rejected');
select pg_temp.expect_error($q$select pg_temp.engine_create('72000000-0000-0000-0000-000000000001',0,1,1,gen_random_uuid(),99.99,null,'   ')$q$,'22023','empty guest name rejected');
select pg_temp.assert_true(pg_temp.engine_create('72000000-0000-0000-0000-000000000003',0,1,1,gen_random_uuid())->>'outcome'='unavailable','inactive type cannot be booked');
select pg_temp.assert_true(pg_temp.engine_create('72000000-0000-0000-0000-000000000004',0,1,1,gen_random_uuid())->>'outcome'='unavailable','inactive hotel cannot be booked');
select pg_temp.assert_true(pg_temp.engine_create('72000000-0000-0000-0000-000000000005',0,1,1,gen_random_uuid())->>'outcome'='unavailable','inactive room cannot be booked');

insert into engine_results values ('created',pg_temp.engine_create('72000000-0000-0000-0000-000000000001',0,3,1,'74000000-0000-0000-0000-000000000002'));
select pg_temp.assert_true((select response->>'outcome'='confirmed' and (response#>>'{booking,total_price}')::numeric=299.97 from engine_results where label='created'), 'booking confirms exact snapshot');
select pg_temp.assert_true((select user_id=auth.uid() and total_price=299.97 from public.bookings where request_id='74000000-0000-0000-0000-000000000002'), 'owner derived from auth.uid');
select pg_temp.assert_true((select pg_temp.engine_create('72000000-0000-0000-0000-000000000001',0,3,1,'74000000-0000-0000-0000-000000000002')#>>'{booking,id}'=response#>>'{booking,id}' from engine_results where label='created'), 'identical retry returns same booking');
select pg_temp.expect_error($q$select pg_temp.engine_create('72000000-0000-0000-0000-000000000001',0,3,2,'74000000-0000-0000-0000-000000000002')$q$,'22023','different payload rejected');
select pg_temp.expect_error($q$select pg_temp.engine_create('72000000-0000-0000-0000-000000000001',0,3,1,'74000000-0000-0000-0000-000000000002',100)$q$,'22023','different expected quote rejected');
reset role;
select pg_temp.assert_true((select count(*)=1 from public.booking_events where booking_id=(select (response#>>'{booking,id}')::uuid from engine_results where label='created')), 'retries create one event only');
select pg_temp.assert_true((select count(*)=0 from public.bookings where request_id='74000000-0000-0000-0000-000000000001'), 'requote created no booking');
update public.room_types set nightly_rate=100.01 where id='72000000-0000-0000-0000-000000000001';
set role authenticated;
select pg_temp.assert_true((pg_temp.engine_create('72000000-0000-0000-0000-000000000001',0,3,1,'74000000-0000-0000-0000-000000000002')#>>'{booking,total_price}')::numeric=299.97,'successful replay ignores later catalog price changes');
select pg_temp.assert_true(pg_temp.engine_create('72000000-0000-0000-0000-000000000001',10,13,1,gen_random_uuid())->>'outcome'='re_quote','price change returns requote');

insert into engine_results values ('single',pg_temp.engine_create('72000000-0000-0000-0000-000000000002',0,3,1,'74000000-0000-0000-0000-000000000003'));
select pg_temp.assert_true(pg_temp.engine_create('72000000-0000-0000-0000-000000000002',1,4,1,gen_random_uuid())->>'outcome'='unavailable','overlapping reservation blocked');
select pg_temp.assert_true(pg_temp.engine_create('72000000-0000-0000-0000-000000000002',3,4,1,gen_random_uuid())->>'outcome'='confirmed','adjacent stay allowed');
select pg_temp.assert_true(pg_temp.engine_create('72000000-0000-0000-0000-000000000002',60,90,1,gen_random_uuid())->>'outcome'='confirmed','exactly 30 nights allowed');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',false);
select pg_temp.expect_error($q$select public.cancel_booking((select (response#>>'{booking,id}')::uuid from engine_results where label='single'))$q$,'42501','another guest cannot cancel');
select pg_temp.expect_error('select public.cancel_booking(gen_random_uuid())','42501','nonexistent booking indistinguishable');
select pg_temp.assert_true(pg_temp.engine_create('72000000-0000-0000-0000-000000000002',20,21,1,'74000000-0000-0000-0000-000000000003')->>'outcome'='confirmed','same request UUID scoped to user');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
select pg_temp.assert_true((select public.cancel_booking((response#>>'{booking,id}')::uuid)->>'outcome'='cancelled' from engine_results where label='single'),'owner cancellation');
select pg_temp.assert_true((select (public.cancel_booking((response#>>'{booking,id}')::uuid)->>'replayed')::boolean from engine_results where label='single'),'repeated cancellation safe');
select pg_temp.assert_true((pg_temp.engine_create('72000000-0000-0000-0000-000000000002',0,3,1,'74000000-0000-0000-0000-000000000003')#>>'{booking,status}')='cancelled','create replay reports current cancelled state');
select pg_temp.assert_true((select available_rooms=1 from public.get_availability(current_date+100,current_date+103,1,null,'72000000-0000-0000-0000-000000000002')),'cancelled stay releases inventory');
select pg_temp.assert_true(pg_temp.engine_create('72000000-0000-0000-0000-000000000002',0,3,1,gen_random_uuid())->>'outcome'='confirmed','released room can be booked again');
select pg_temp.expect_error('update public.bookings set status=''cancelled''','42501','direct booking writes remain forbidden');
select pg_temp.expect_error('insert into public.booking_events default values','42501','direct event writes remain forbidden');
reset role;
select pg_temp.assert_true((select count(*)=1 from public.booking_events where event_type='cancelled' and booking_id=(select (response#>>'{booking,id}')::uuid from engine_results where label='single')), 'one cancellation event only');
select pg_temp.assert_true((select actor_id='10000000-0000-0000-0000-000000000001' from public.booking_events where event_type='cancelled' and booking_id=(select (response#>>'{booking,id}')::uuid from engine_results where label='single')),'server-generated event actor');

-- The session date is deliberately ahead of the west hotel's local date.
set timezone='Pacific/Kiritimati';
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
insert into engine_results values ('today',public.create_booking('72000000-0000-0000-0000-000000000006',
  (clock_timestamp() at time zone 'Pacific/Pago_Pago')::date,
  (clock_timestamp() at time zone 'Pacific/Pago_Pago')::date+1,1,'Today guest','Test phone','',gen_random_uuid(),99.99,99.99));
select pg_temp.assert_true((select response->>'outcome'='confirmed' from engine_results where label='today'),'hotel-local today allowed despite session timezone');
select pg_temp.expect_error($q$select public.cancel_booking((select (response#>>'{booking,id}')::uuid from engine_results where label='today'))$q$,'42501','guest cannot cancel on local checkin day');
select pg_temp.expect_error($q$select public.create_booking('72000000-0000-0000-0000-000000000001',(clock_timestamp() at time zone 'Pacific/Kiritimati')::date-1,(clock_timestamp() at time zone 'Pacific/Kiritimati')::date+1,1,'Test','Test','',gen_random_uuid(),99.99,199.98)$q$,'22023','hotel-local past date rejected');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',false);
select pg_temp.assert_true((select public.cancel_booking((response#>>'{booking,id}')::uuid)->>'outcome'='cancelled' from engine_results where label='today'),'admin can cancel on checkin day');
reset role;
set timezone='UTC';
select set_config('request.jwt.claim.sub','',false);
select pg_temp.assert_true(not has_table_privilege('authenticated','private.booking_requests','SELECT,INSERT,UPDATE,DELETE'),'private ledger is inaccessible');
select pg_temp.assert_true((select bool_and(not p.prosecdef) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('get_availability','create_booking','cancel_booking')),'public wrappers are invokers');
select 'PASS: booking engine quotes, input validation, idempotency, eligibility, adjacent stays, cancellation, privacy and authorization';
