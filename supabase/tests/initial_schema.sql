-- Local-only fixtures. This script must never run against the hosted project.
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

select pg_temp.assert_true((select count(*) = 8 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity), 'all eight tables enable RLS');
select pg_temp.assert_true((select role='guest' from public.user_roles where user_id='10000000-0000-0000-0000-000000000001'), 'backfill never trusts metadata admin role');
select pg_temp.assert_true((select display_name='Existing user' from public.profiles where id='10000000-0000-0000-0000-000000000001'), 'existing account profile backfilled');
insert into auth.users values
 ('10000000-0000-0000-0000-000000000002','{"display_name":"New guest","role":"admin"}'),
 ('10000000-0000-0000-0000-000000000003','{"display_name":"Trusted admin"}');
update public.user_roles set role='admin' where user_id='10000000-0000-0000-0000-000000000003';
select pg_temp.assert_true((select role='guest' from public.user_roles where user_id='10000000-0000-0000-0000-000000000002'), 'signup metadata cannot grant admin');

insert into public.hotels(id,name,city,country,address,timezone,is_active) values
 ('20000000-0000-0000-0000-000000000001','Test hotel','Test city','Test country','Test address','Europe/Sofia',true),
 ('20000000-0000-0000-0000-000000000002','Hidden hotel','Test city','Test country','Test address','UTC',false);
insert into public.room_types(id,hotel_id,name,capacity,nightly_rate,is_active) values
 ('21000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Test type',2,100,true),
 ('21000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','Second type',2,120,true),
 ('21000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002','Hidden type',2,100,true);
insert into public.rooms(id,room_type_id,room_number,is_active) values
 ('30000000-0000-0000-0000-000000000001','21000000-0000-0000-0000-000000000001','101',true),
 ('30000000-0000-0000-0000-000000000002','21000000-0000-0000-0000-000000000003','101',true);
insert into public.hotel_images(hotel_id,storage_path,alt_text,is_cover) values
 ('20000000-0000-0000-0000-000000000001','test/public.jpg','Test image',true),
 ('20000000-0000-0000-0000-000000000002','test/hidden.jpg','Hidden image',true);

select pg_temp.expect_error($q$update public.hotels set timezone='Not/AZone'$q$,'23514','invalid IANA timezone');
select pg_temp.expect_error($q$update public.room_types set capacity=0$q$,'23514','positive capacity');
select pg_temp.expect_error($q$update public.room_types set nightly_rate=-1$q$,'23514','nonnegative rate');
select pg_temp.expect_error($q$update public.room_types set nightly_rate='NaN'$q$,'23514','NaN rate rejected');
select pg_temp.expect_error($q$update public.room_types set currency='USD'$q$,'23514','EUR only');
select pg_temp.expect_error($q$insert into public.rooms(room_type_id,room_number) values ('21000000-0000-0000-0000-000000000002','101')$q$,'23505','hotel-wide room number uniqueness across types');

insert into public.bookings(id,user_id,room_id,check_in,check_out,guest_count,guest_name,contact_phone,request_id)
values ('50000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','2030-01-01','2030-01-03',2,'Test guest','Test phone','60000000-0000-0000-0000-000000000001');
select pg_temp.assert_true((select total_price=200 and nightly_rate_snapshot=100 and hotel_name_snapshot='Test hotel' and room_type_name_snapshot='Test type' from public.bookings), 'trusted price and name snapshots');
select pg_temp.assert_true((select count(*)=1 from public.booking_events), 'confirmation audit event');
update public.room_types set nightly_rate=150 where id='21000000-0000-0000-0000-000000000001';
select pg_temp.assert_true((select nightly_rate_snapshot=100 from public.bookings), 'catalog changes preserve snapshots');
select pg_temp.expect_error($q$update public.bookings set total_price=0$q$,'23514','immutable reservation details');
select pg_temp.expect_error($q$delete from public.bookings$q$,'23514','preserve booking history');
select pg_temp.expect_error($q$delete from public.rooms where id='30000000-0000-0000-0000-000000000001'$q$,'23503','restrict referenced room deletion');
select pg_temp.expect_error($q$delete from public.room_types where id='21000000-0000-0000-0000-000000000001'$q$,'23503','restrict referenced room type deletion');
select pg_temp.expect_error($q$delete from public.hotels where id='20000000-0000-0000-0000-000000000001'$q$,'23503','restrict referenced hotel deletion');
select pg_temp.expect_error($q$delete from auth.users where id='10000000-0000-0000-0000-000000000001'$q$,'23503','account deletion preserves bookings');
select pg_temp.expect_error($q$update public.room_types set capacity=1 where id='21000000-0000-0000-0000-000000000001'$q$,'23514','capacity must preserve confirmed reservations');
select pg_temp.expect_error($q$update public.rooms set room_type_id='21000000-0000-0000-0000-000000000002' where id='30000000-0000-0000-0000-000000000001'$q$,'23514','booked room cannot move types');

select pg_temp.expect_error($q$insert into public.bookings(user_id,room_id,check_in,check_out,guest_count,guest_name,contact_phone,request_id) values ('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','2030-01-02','2030-01-04',1,'Test guest','Test phone',gen_random_uuid())$q$,'23P01','overlapping reservation rejected');
select pg_temp.expect_error($q$insert into public.bookings(user_id,room_id,check_in,check_out,guest_count,guest_name,contact_phone,request_id) values ('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','2030-02-01','2030-02-01',1,'Test guest','Test phone',gen_random_uuid())$q$,'23514','checkout after checkin');
select pg_temp.expect_error($q$insert into public.bookings(user_id,room_id,check_in,check_out,guest_count,guest_name,contact_phone,request_id) values ('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','2030-02-01','2030-02-02',3,'Test guest','Test phone',gen_random_uuid())$q$,'23514','room occupancy enforcement');
select pg_temp.expect_error($q$insert into public.bookings(user_id,room_id,check_in,check_out,guest_count,guest_name,contact_phone,request_id) values ('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','2030-02-01','2030-02-02',0,'Test guest','Test phone',gen_random_uuid())$q$,'23514','positive guests');
insert into public.bookings(user_id,room_id,check_in,check_out,guest_count,guest_name,contact_phone,request_id)
values ('10000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001','2030-01-03','2030-01-04',1,'Other guest','Test phone','60000000-0000-0000-0000-000000000002');
select pg_temp.assert_true((select count(*)=2 from public.bookings), 'back-to-back stays allowed');
select pg_temp.expect_error($q$insert into public.bookings(user_id,room_id,check_in,check_out,guest_count,guest_name,contact_phone,request_id) values ('10000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','2030-02-01','2030-02-02',1,'Test guest','Test phone','60000000-0000-0000-0000-000000000001')$q$,'23505','per-user idempotency key uniqueness');

set role anon;
select pg_temp.assert_true((select count(*)=1 from public.hotels), 'visitors see only published hotels');
select pg_temp.assert_true((select count(*)=2 from public.room_types), 'hidden hotel types not public');
select pg_temp.assert_true((select count(*)=1 from public.hotel_images), 'hidden hotel images not public');
select pg_temp.expect_error('select * from public.bookings','42501','visitor cannot read bookings');
select pg_temp.expect_error('select * from public.rooms','42501','visitor cannot read inventory');
select pg_temp.expect_error('select * from public.profiles','42501','visitor cannot read profiles');
select pg_temp.expect_error('select private.is_admin()','42501','visitor cannot call role helper');
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',false);
select pg_temp.assert_true(not private.is_admin(), 'guest admin helper is nonrecursive');
select pg_temp.assert_true((select count(*)=1 from public.bookings), 'guest booking isolation');
select pg_temp.assert_true((select count(*)=1 from public.profiles), 'guest profile isolation');
select pg_temp.assert_true((select count(*)=0 from public.rooms), 'guest cannot read physical inventory');
select pg_temp.assert_true((select count(*)=0 from public.booking_events), 'guest cannot read audit stream');
update public.profiles set display_name='Edited name',phone='Test phone' where id=auth.uid();
select pg_temp.assert_true((select display_name='Edited name' from public.profiles), 'own permitted profile fields editable');
select pg_temp.expect_error('update public.profiles set updated_at=now()','42501','guest cannot control timestamps');
select pg_temp.expect_error('update public.user_roles set role=''admin''','42501','guest cannot promote self');
select pg_temp.expect_error('update public.bookings set status=''cancelled''','42501','guest cannot directly mutate booking');
select pg_temp.expect_error('insert into public.bookings default values','42501','guest cannot directly insert booking');
select pg_temp.expect_error('delete from public.booking_events','42501','guest cannot alter events');
select pg_temp.expect_error($q$insert into public.hotels(name,city,country,address,timezone) values ('Unauthorized','x','x','x','UTC')$q$,'42501','guest cannot edit catalog');
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',false);
select pg_temp.assert_true(private.is_admin(), 'trusted admin helper works without recursion');
select pg_temp.assert_true((select count(*)=2 from public.bookings), 'admin reads all bookings');
select pg_temp.assert_true((select count(*)=2 from public.rooms), 'admin reads inventory');
select pg_temp.assert_true((select count(*)=2 from public.hotels), 'admin reads unpublished hotels');
select pg_temp.assert_true((select count(*)=2 from public.booking_events), 'admin reads audit events');
select pg_temp.assert_true((select count(*)=1 from public.profiles), 'admin has no blanket profile access');
update public.hotels set description='Admin update' where id='20000000-0000-0000-0000-000000000002';
select pg_temp.assert_true((select description='Admin update' from public.hotels where id='20000000-0000-0000-0000-000000000002'), 'admin catalog update');
select pg_temp.expect_error('update public.bookings set status=''cancelled''','42501','admin cannot bypass reservation operation boundary');
reset role;
select set_config('request.jwt.claim.sub','',false);

update public.bookings set status='cancelled' where id='50000000-0000-0000-0000-000000000001';
select pg_temp.assert_true((select cancelled_at is not null from public.bookings where id='50000000-0000-0000-0000-000000000001'), 'trusted cancellation maintains timestamp');
select pg_temp.assert_true((select count(*)=3 from public.booking_events), 'cancellation is audited');
select pg_temp.expect_error($q$update public.bookings set status='confirmed' where id='50000000-0000-0000-0000-000000000001'$q$,'23514','cancelled booking cannot be revived');
select pg_temp.expect_error('update public.booking_events set details=''{}''','23514','events append-only');
select pg_temp.assert_true((select bool_and(updated_at>=created_at) from public.hotels), 'timestamp maintenance');
select 'PASS: schema constraints, backfill/signup, snapshots, history, RLS, grants, admin boundary and audit lifecycle';
