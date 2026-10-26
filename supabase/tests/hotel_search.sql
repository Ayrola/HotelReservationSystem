-- Focused local-only search checks; no remote fixtures.
begin;
create function pg_temp.search_assert(value boolean,label text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'FAIL: %',label; end if; end; $$;
insert into public.hotels(id,name,city,country,address,timezone,is_active)
select ('91000000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid,
  case when n=15 then 'AAA global cheapest' else 'Search hotel '||lpad(n::text,2,'0') end,
  'SearchFixture','Bulgaria','Fixture','Europe/Sofia',n<>16
from generate_series(1,16) n;
insert into public.room_types(id,hotel_id,name,capacity,nightly_rate,is_active)
select ('92000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 ('91000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'Double',2,
 case when n=15 then 5 else n*10 end,true from generate_series(1,16) n;
insert into public.rooms(id,room_type_id,room_number,is_active)
select ('93000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
 ('92000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'101',true from generate_series(1,16) n;
insert into public.bookings(user_id,room_id,check_in,check_out,guest_count,guest_name,contact_phone,request_id)
values('10000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000001',
 current_date+100,current_date+103,1,'Private guest','Private phone',gen_random_uuid());
set local role anon;
do $$ declare result jsonb; begin
  result := public.search_hotels(p_destination=>'SearchFixture');
  perform pg_temp.search_assert((result->>'total_count')::int=15,'full hotel count excludes unpublished');
  perform pg_temp.search_assert(jsonb_array_length(result->'hotels')=12,'first page bounded');
  perform pg_temp.search_assert(result#>>'{hotels,0,name}'='AAA global cheapest','global price sorting');
  perform pg_temp.search_assert((result->>'dated')::boolean=false and result->'nights'='null'::jsonb,'undated is catalog only');
  result := public.search_hotels(p_destination=>'SearchFixture',p_page=>2);
  perform pg_temp.search_assert(jsonb_array_length(result->'hotels')=3 and (result->>'total_count')::int=15,'second page count stable');
  result := public.search_hotels(p_destination=>'SearchFixture',p_max_price=>6);
  perform pg_temp.search_assert((result->>'total_count')::int=1 and result#>>'{hotels,0,name}'='AAA global cheapest','budget applied before paging');
  result := public.search_hotels(current_date+100,current_date+103,2,'SearchFixture');
  perform pg_temp.search_assert((result->>'total_count')::int=14,'availability excludes blocked hotel');
  perform pg_temp.search_assert(result#>>'{hotels,0,total_price}'='15.00','exact stay price');
  perform pg_temp.search_assert(position('Private guest' in result::text)=0 and position('room_id' in result::text)=0,'no guest or physical room data');
  result := public.search_hotels(p_destination=>'SearchFixture',p_sort=>'name_desc',p_page=>999);
  perform pg_temp.search_assert((result->>'total_count')::int=15 and result->'hotels'='[]'::jsonb,'empty page retains count');
  result := public.search_hotels(p_destination=>'SearchFixture',p_sort=>'name_desc');
  perform pg_temp.search_assert(result#>>'{hotels,0,name}'='Search hotel 14','global name sort');
  begin
    perform public.search_hotels(current_date,null);
    raise exception 'partial dates accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.search_hotels(p_sort=>'unsafe');
    raise exception 'invalid sort accepted';
  exception when invalid_parameter_value then null; end;
end $$;
reset role;
select 'PASS: search availability, catalog, global filters/sorting, pagination/counts and public data boundary';
rollback;
