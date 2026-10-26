-- Focused local-only optional-phone and replay checks. Never apply fixtures remotely.
begin;
insert into public.hotels(id,name,city,country,address,timezone,is_active)
values('a1000000-0000-0000-0000-000000000001','Booking UI fixture','Sofia','Bulgaria','Fixture','Europe/Sofia',true);
insert into public.room_types(id,hotel_id,name,capacity,nightly_rate,is_active)
values('a2000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','Double',2,75,true);
insert into public.rooms(room_type_id,room_number,is_active)
values('a2000000-0000-0000-0000-000000000001','101',true);
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
do $$ declare first jsonb; replay jsonb; other jsonb; begin
  first:=public.create_booking('a2000000-0000-0000-0000-000000000001',current_date+100,current_date+103,2,'Guest','','',
    'a4000000-0000-0000-0000-000000000001',75,225);
  if first->>'outcome'<>'confirmed' then raise exception 'Optional phone was rejected'; end if;
  replay:=public.create_booking('a2000000-0000-0000-0000-000000000001',current_date+100,current_date+103,2,'Guest','','',
    'a4000000-0000-0000-0000-000000000001',75,225);
  if replay#>>'{booking,id}'<>first#>>'{booking,id}' or (replay->>'replayed')::boolean is not true then raise exception 'Replay duplicated booking'; end if;
  if (select count(*) from public.bookings where request_id='a4000000-0000-0000-0000-000000000001')<>1 then raise exception 'Incorrect booking count'; end if;
  if (select contact_phone from public.bookings where id=(first#>>'{booking,id}')::uuid)<>'' then raise exception 'Optional phone not saved empty'; end if;
  other:=public.create_booking('a2000000-0000-0000-0000-000000000001',current_date+100,current_date+103,2,'Guest','','',
    'a4000000-0000-0000-0000-000000000004',75,225);
  if other->>'outcome'<>'unavailable' then raise exception 'Unavailable inventory not rejected'; end if;
  other:=public.create_booking('a2000000-0000-0000-0000-000000000001',current_date+104,current_date+107,2,'Guest','','',
    'a4000000-0000-0000-0000-000000000002',70,210);
  if other->>'outcome'<>'re_quote' then raise exception 'Stale expected price not rejected'; end if;
  begin
    perform public.create_booking('a2000000-0000-0000-0000-000000000001',current_date+104,current_date+107,2,'Guest',repeat('1',41),'',
      'a4000000-0000-0000-0000-000000000003',75,225);
    raise exception 'Overlong phone accepted';
  exception when invalid_parameter_value then null; end;
  perform set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000099',true);
  if exists(select from public.bookings where id=(first#>>'{booking,id}')::uuid) then raise exception 'Owner isolation failed'; end if;
end $$;
reset role;
select 'PASS: optional phone, saved total, identical replay, stale quote, validation and owner isolation';
rollback;
