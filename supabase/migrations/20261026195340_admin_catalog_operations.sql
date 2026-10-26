-- Catalog administration only; no public role-provisioning operation.
create function private.admin_timezones() returns setof text
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.is_admin() then
    raise exception 'Administrator session required' using errcode='42501';
  end if;
  return query select name from pg_catalog.pg_timezone_names
    where name='UTC' or (name like '%/%' and name !~ '^(posix|right)/') order by name;
end; $$;
create function public.admin_timezones() returns setof text
language sql stable security invoker set search_path = '' as $$ select * from private.admin_timezones(); $$;

create function private.admin_remove_catalog(p_kind text,p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' set lock_timeout='3s' as $$
declare referenced boolean;
begin
  if auth.uid() is null or not private.is_admin() then
    raise exception 'Administrator session required' using errcode='42501';
  end if;
  if p_id is null then raise exception 'Record ID required' using errcode='22023'; end if;
  if p_kind='hotel' then
    perform 1 from public.hotels where id=p_id for update;
    if not found then raise exception 'Record not found' using errcode='22023'; end if;
    select exists(select from public.room_types where hotel_id=p_id)
      or exists(select from public.hotel_images where hotel_id=p_id) into referenced;
    -- Booking history necessarily retains its room/type/hotel foreign-key chain.
    if referenced then update public.hotels set is_active=false where id=p_id;
    else delete from public.hotels where id=p_id; end if;
  elsif p_kind='room_type' then
    perform 1 from public.room_types where id=p_id for update;
    if not found then raise exception 'Record not found' using errcode='22023'; end if;
    select exists(select from public.rooms where room_type_id=p_id) into referenced;
    if referenced then update public.room_types set is_active=false where id=p_id;
    else delete from public.room_types where id=p_id; end if;
  elsif p_kind='room' then
    perform 1 from public.rooms where id=p_id for update;
    if not found then raise exception 'Record not found' using errcode='22023'; end if;
    select exists(select from public.bookings where room_id=p_id) into referenced;
    if referenced then update public.rooms set is_active=false where id=p_id;
    else delete from public.rooms where id=p_id; end if;
  else raise exception 'Unsupported catalog kind' using errcode='22023';
  end if;
  return jsonb_build_object('outcome',case when referenced then 'deactivated' else 'deleted' end);
exception when foreign_key_violation then
  -- A concurrently added relationship must never cause a destructive cascade.
  raise exception 'Record became referenced. Refresh and deactivate it instead.' using errcode='23503';
end; $$;
create function public.admin_remove_catalog(p_kind text,p_id uuid) returns jsonb
language sql security invoker set search_path = '' as $$ select private.admin_remove_catalog(p_kind,p_id); $$;
revoke all on function private.admin_timezones(),public.admin_timezones(),
  private.admin_remove_catalog(text,uuid),public.admin_remove_catalog(text,uuid) from public,anon,authenticated;
grant execute on function private.admin_timezones(),public.admin_timezones(),
  private.admin_remove_catalog(text,uuid),public.admin_remove_catalog(text,uuid) to authenticated;
notify pgrst,'reload schema';
