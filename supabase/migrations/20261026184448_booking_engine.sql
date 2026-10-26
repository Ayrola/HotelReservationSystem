-- Server-side booking operations. Keep the original applied migration unchanged.
create table private.booking_requests (
  user_id uuid not null references auth.users(id) on delete restrict,
  request_id uuid not null,
  payload_hash bytea not null check (octet_length(payload_hash) = 32),
  booking_id uuid unique references public.bookings(id) on delete restrict,
  response jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, request_id)
);
alter table private.booking_requests enable row level security;
revoke all on private.booking_requests from public, anon, authenticated;

create function private.validate_stay(p_check_in date, p_check_out date, p_guest_count integer)
returns void language plpgsql immutable set search_path = ''
as $$
begin
  if p_check_in is null or p_check_out is null or not isfinite(p_check_in) or not isfinite(p_check_out)
    or p_check_out <= p_check_in or p_check_out - p_check_in > 30
    or p_guest_count is null or p_guest_count <= 0 then
    raise exception 'Provide finite check-in/check-out dates for 1 to 30 nights and a positive guest count' using errcode = '22023';
  end if;
end;
$$;

create function private.booking_payload_hash(
  p_room_type_id uuid, p_check_in date, p_check_out date, p_guest_count integer,
  p_guest_name text, p_contact_phone text, p_special_requests text,
  p_expected_nightly_rate numeric, p_expected_total_price numeric
)
returns bytea language sql immutable set search_path = ''
as $$
  select sha256(convert_to(jsonb_build_object(
    'room_type_id', p_room_type_id, 'check_in', p_check_in, 'check_out', p_check_out,
    'guest_count', p_guest_count, 'guest_name', btrim(p_guest_name),
    'contact_phone', btrim(p_contact_phone), 'special_requests', coalesce(p_special_requests, ''),
    'expected_nightly_rate', round(p_expected_nightly_rate, 2),
    'expected_total_price', round(p_expected_total_price, 2), 'currency', 'EUR'
  )::text, 'UTF8'));
$$;

create function private.booking_result(p_booking public.bookings)
returns jsonb language sql stable set search_path = ''
as $$
  select jsonb_build_object(
    'id', p_booking.id, 'reference', p_booking.reference, 'status', p_booking.status,
    'check_in', p_booking.check_in, 'check_out', p_booking.check_out,
    'guest_count', p_booking.guest_count, 'nightly_rate', p_booking.nightly_rate_snapshot,
    'total_price', p_booking.total_price, 'currency', p_booking.currency,
    'hotel_name', p_booking.hotel_name_snapshot, 'room_type_name', p_booking.room_type_name_snapshot,
    'cancelled_at', p_booking.cancelled_at
  );
$$;

-- Adopt existing idempotency keys without changing any historical booking.
insert into private.booking_requests(user_id, request_id, payload_hash, booking_id)
select b.user_id, b.request_id,
  private.booking_payload_hash(r.room_type_id, b.check_in, b.check_out, b.guest_count,
    b.guest_name, b.contact_phone, b.special_requests, b.nightly_rate_snapshot, b.total_price), b.id
from public.bookings b join public.rooms r on r.id = b.room_id;

-- Enforce new eligibility rules even for future privileged write paths.
-- Historical rows are not rewritten or subjected to new creation-date checks.
create function private.enforce_booking_eligibility()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare hotel_zone text; caller uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    begin
      perform private.validate_stay(new.check_in, new.check_out, new.guest_count);
    exception when invalid_parameter_value then
      raise exception 'Booking requires a valid stay of 1 to 30 nights and positive guests' using errcode = '23514';
    end;
    select h.timezone into hotel_zone from public.rooms r
      join public.room_types rt on rt.id = r.room_type_id
      join public.hotels h on h.id = rt.hotel_id where r.id = new.room_id
      for share of h, rt, r;
    if not found then raise exception 'Unknown room' using errcode = '23503'; end if;
    if new.check_in < (clock_timestamp() at time zone hotel_zone)::date then
      raise exception 'Check-in cannot precede the hotel-local current date' using errcode = '23514';
    end if;
    if caller is not null and new.user_id is distinct from caller then
      raise exception 'Booking owner must be the authenticated caller' using errcode = '42501';
    end if;
  elsif old.status = 'confirmed' and new.status = 'cancelled' and caller is not null then
    if not private.is_admin() then
      if old.user_id is distinct from caller then
        raise exception 'Cancellation is not authorized' using errcode = '42501';
      end if;
      select h.timezone into hotel_zone from public.rooms r
        join public.room_types rt on rt.id = r.room_type_id
        join public.hotels h on h.id = rt.hotel_id where r.id = old.room_id for share of h;
      if old.check_in <= (clock_timestamp() at time zone hotel_zone)::date then
        raise exception 'Guest cancellation is allowed only before hotel-local check-in day' using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end;
$$;
create trigger bookings_eligibility before insert or update of status on public.bookings
  for each row execute function private.enforce_booking_eligibility();

create function private.get_availability(
  p_check_in date, p_check_out date, p_guest_count integer,
  p_hotel_id uuid, p_room_type_id uuid
)
returns table (
  hotel_id uuid, room_type_id uuid, hotel_name text, room_type_name text,
  hotel_timezone text, capacity integer, available_rooms bigint,
  nights integer, nightly_rate numeric, total_price numeric, currency text
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.validate_stay(p_check_in, p_check_out, p_guest_count);
  return query
    select h.id, rt.id, h.name, rt.name, h.timezone, rt.capacity,
      (select count(*) from public.rooms r
        where r.room_type_id = rt.id and r.is_active and not exists (
          select 1 from public.bookings b where b.room_id = r.id and b.status = 'confirmed'
            and daterange(b.check_in, b.check_out, '[)') && daterange(p_check_in, p_check_out, '[)')
        )), p_check_out - p_check_in, rt.nightly_rate,
      rt.nightly_rate * (p_check_out - p_check_in), rt.currency
    from public.hotels h join public.room_types rt on rt.hotel_id = h.id
    where h.is_active and rt.is_active and rt.capacity >= p_guest_count
      and p_check_in >= (statement_timestamp() at time zone h.timezone)::date
      and (p_hotel_id is null or h.id = p_hotel_id)
      and (p_room_type_id is null or rt.id = p_room_type_id)
    order by h.id, rt.id;
end;
$$;

create function private.create_booking(
  p_room_type_id uuid, p_check_in date, p_check_out date, p_guest_count integer,
  p_guest_name text, p_contact_phone text, p_special_requests text,
  p_request_id uuid, p_expected_nightly_rate numeric, p_expected_total_price numeric
)
returns jsonb language plpgsql security definer set search_path = '' set lock_timeout = '2s'
as $$
declare
  caller uuid := auth.uid(); fingerprint bytea; request private.booking_requests%rowtype;
  catalog record; selected_room uuid; booking public.bookings%rowtype;
  actual_total numeric; quote jsonb; result jsonb; attempt integer;
begin
  if caller is null or not exists (select 1 from public.user_roles ur where ur.user_id = caller) then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;
  perform private.validate_stay(p_check_in, p_check_out, p_guest_count);
  if p_room_type_id is null or p_request_id is null
    or p_guest_name is null or char_length(btrim(p_guest_name)) not between 1 and 200
    or p_contact_phone is null or char_length(btrim(p_contact_phone)) not between 1 and 40
    or char_length(coalesce(p_special_requests, '')) > 2000
    or p_expected_nightly_rate is null or p_expected_total_price is null
    or p_expected_nightly_rate < 0 or p_expected_total_price < 0
    or p_expected_nightly_rate >= 'Infinity'::numeric or p_expected_total_price >= 'Infinity'::numeric
    or p_expected_nightly_rate <> round(p_expected_nightly_rate, 2)
    or p_expected_total_price <> round(p_expected_total_price, 2) then
    raise exception 'Invalid booking details or expected EUR quote' using errcode = '22023';
  end if;
  fingerprint := private.booking_payload_hash(p_room_type_id, p_check_in, p_check_out, p_guest_count,
    p_guest_name, p_contact_phone, p_special_requests, p_expected_nightly_rate, p_expected_total_price);
  insert into private.booking_requests(user_id, request_id, payload_hash)
    values (caller, p_request_id, fingerprint) on conflict (user_id, request_id) do nothing;
  -- ON CONFLICT plus a subsequent row lock serializes simultaneous identical keys.
  select br.* into request from private.booking_requests br
    where br.user_id = caller and br.request_id = p_request_id for update;
  if request.payload_hash is distinct from fingerprint then
    raise exception 'Request ID was already used with a different payload' using errcode = '22023';
  end if;
  if request.booking_id is not null then
    select b.* into booking from public.bookings b where b.id = request.booking_id;
    return jsonb_build_object('outcome', booking.status, 'replayed', true, 'booking', private.booking_result(booking));
  end if;
  if request.response is not null then return request.response || jsonb_build_object('replayed', true); end if;

  begin
  select h.timezone, h.is_active as hotel_active, rt.is_active as type_active, rt.capacity, rt.nightly_rate
    into catalog from public.room_types rt join public.hotels h on h.id = rt.hotel_id
    where rt.id = p_room_type_id for share of h, rt;
  if not found or not catalog.hotel_active or not catalog.type_active then
    result := jsonb_build_object('outcome', 'unavailable', 'replayed', false);
  elsif p_guest_count > catalog.capacity then
    raise exception 'Guest count exceeds room-type capacity' using errcode = '22023';
  elsif p_check_in < (clock_timestamp() at time zone catalog.timezone)::date then
    raise exception 'Check-in cannot precede the hotel-local current date' using errcode = '22023';
  else
    actual_total := catalog.nightly_rate * (p_check_out - p_check_in);
    quote := jsonb_build_object('room_type_id', p_room_type_id, 'check_in', p_check_in,
      'check_out', p_check_out, 'guest_count', p_guest_count, 'nights', p_check_out - p_check_in,
      'nightly_rate', catalog.nightly_rate, 'total_price', actual_total, 'currency', 'EUR');
    if actual_total > 9999999999.99 then
      raise exception 'Quote exceeds the supported booking amount' using errcode = '22003';
    end if;
    if p_expected_nightly_rate <> catalog.nightly_rate or p_expected_total_price <> actual_total then
      result := jsonb_build_object('outcome', 're_quote', 'replayed', false, 'quote', quote);
    else
      for attempt in 1..3 loop
        begin
          select r.id into selected_room from public.rooms r
            where r.room_type_id = p_room_type_id and r.is_active and not exists (
              select 1 from public.bookings b where b.room_id = r.id and b.status = 'confirmed'
                and daterange(b.check_in, b.check_out, '[)') && daterange(p_check_in, p_check_out, '[)')
            ) order by r.id limit 1 for update of r skip locked;
          if found then
            insert into public.bookings(user_id, room_id, check_in, check_out, guest_count,
              guest_name, contact_phone, special_requests, request_id)
            values (caller, selected_room, p_check_in, p_check_out, p_guest_count,
              btrim(p_guest_name), btrim(p_contact_phone), coalesce(p_special_requests, ''), p_request_id)
            returning * into booking;
            result := jsonb_build_object('outcome', 'confirmed', 'replayed', false,
              'booking', private.booking_result(booking));
            update private.booking_requests br set booking_id = booking.id, response = result
              where br.user_id = caller and br.request_id = p_request_id;
            return result;
          end if;
        exception when exclusion_violation then
          -- Roll back this attempt's insert/locks/event before trying another room.
          null;
        end;
        if not exists (
          select 1 from public.rooms r where r.room_type_id = p_room_type_id and r.is_active
            and not exists (select 1 from public.bookings b where b.room_id = r.id and b.status = 'confirmed'
              and daterange(b.check_in, b.check_out, '[)') && daterange(p_check_in, p_check_out, '[)'))
        ) then
          result := jsonb_build_object('outcome', 'unavailable', 'replayed', false);
          exit;
        end if;
      end loop;
      if result is null then
        -- Retain the fingerprint, but do not cache transient contention as a final outcome.
        return jsonb_build_object('outcome', 'retryable_busy', 'replayed', false);
      end if;
    end if;
  end if;
  update private.booking_requests br set response = result
    where br.user_id = caller and br.request_id = p_request_id;
  return result;
  exception when lock_not_available or deadlock_detected or serialization_failure then
    -- Preserve the request fingerprint when post-ledger catalog/allocation locks fail.
    return jsonb_build_object('outcome', 'retryable_busy', 'replayed', false);
  end;
exception when lock_not_available or deadlock_detected or serialization_failure then
  -- A competing request-ledger owner has not committed yet. No local write survives.
  return jsonb_build_object('outcome', 'retryable_busy', 'replayed', false);
end;
$$;

create function private.cancel_booking(p_booking_id uuid)
returns jsonb language plpgsql security definer set search_path = '' set lock_timeout = '2s'
as $$
declare caller uuid := auth.uid(); booking public.bookings%rowtype; admin boolean; hotel_zone text;
begin
  if caller is null then raise exception 'Authentication is required' using errcode = '42501'; end if;
  admin := private.is_admin();
  select b.* into booking from public.bookings b where b.id = p_booking_id for update;
  if not found or (booking.user_id is distinct from caller and not admin) then
    raise exception 'Booking is not accessible' using errcode = '42501';
  end if;
  if booking.status = 'cancelled' then
    return jsonb_build_object('outcome', 'cancelled', 'replayed', true, 'booking', private.booking_result(booking));
  end if;
  select h.timezone into hotel_zone from public.rooms r
    join public.room_types rt on rt.id = r.room_type_id
    join public.hotels h on h.id = rt.hotel_id where r.id = booking.room_id for share of h;
  if not admin and booking.check_in <= (clock_timestamp() at time zone hotel_zone)::date then
    raise exception 'Guest cancellation is allowed only before hotel-local check-in day' using errcode = '42501';
  end if;
  update public.bookings b set status = 'cancelled' where b.id = booking.id returning * into booking;
  return jsonb_build_object('outcome', 'cancelled', 'replayed', false, 'booking', private.booking_result(booking));
exception when lock_not_available or deadlock_detected or serialization_failure then
  return jsonb_build_object('outcome', 'retryable_busy', 'replayed', false);
end;
$$;

-- Exposed wrappers are invokers; elevated implementations stay in private schema.
create function public.get_availability(p_check_in date, p_check_out date, p_guest_count integer,
  p_hotel_id uuid default null, p_room_type_id uuid default null)
returns table(hotel_id uuid, room_type_id uuid, hotel_name text, room_type_name text,
  hotel_timezone text, capacity integer, available_rooms bigint, nights integer,
  nightly_rate numeric, total_price numeric, currency text)
language sql stable security invoker set search_path = ''
as $$ select * from private.get_availability(p_check_in, p_check_out, p_guest_count, p_hotel_id, p_room_type_id); $$;

create function public.create_booking(p_room_type_id uuid, p_check_in date, p_check_out date,
  p_guest_count integer, p_guest_name text, p_contact_phone text, p_special_requests text,
  p_request_id uuid, p_expected_nightly_rate numeric, p_expected_total_price numeric)
returns jsonb language sql volatile security invoker set search_path = ''
as $$ select private.create_booking(p_room_type_id, p_check_in, p_check_out, p_guest_count,
  p_guest_name, p_contact_phone, p_special_requests, p_request_id, p_expected_nightly_rate, p_expected_total_price); $$;

create function public.cancel_booking(p_booking_id uuid)
returns jsonb language sql volatile security invoker set search_path = ''
as $$ select private.cancel_booking(p_booking_id); $$;

revoke all on function private.validate_stay(date,date,integer),
  private.booking_payload_hash(uuid,date,date,integer,text,text,text,numeric,numeric),
  private.booking_result(public.bookings), private.enforce_booking_eligibility(),
  private.get_availability(date,date,integer,uuid,uuid),
  private.create_booking(uuid,date,date,integer,text,text,text,uuid,numeric,numeric), private.cancel_booking(uuid),
  public.get_availability(date,date,integer,uuid,uuid),
  public.create_booking(uuid,date,date,integer,text,text,text,uuid,numeric,numeric), public.cancel_booking(uuid)
  from public, anon, authenticated;
grant execute on function private.get_availability(date,date,integer,uuid,uuid),
  public.get_availability(date,date,integer,uuid,uuid) to anon, authenticated;
grant execute on function private.create_booking(uuid,date,date,integer,text,text,text,uuid,numeric,numeric),
  private.cancel_booking(uuid), public.create_booking(uuid,date,date,integer,text,text,text,uuid,numeric,numeric),
  public.cancel_booking(uuid) to authenticated;

-- The original bookings_no_overlapping_confirmed exclusion remains the final
-- database-level protection; direct booking/event mutation grants remain revoked.
notify pgrst, 'reload schema';
