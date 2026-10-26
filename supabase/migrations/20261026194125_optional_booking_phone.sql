-- User-authorized optional booking phone. Empty string represents no phone.
-- All allocation, quote, ownership and idempotency logic is retained verbatim.
alter table public.bookings drop constraint bookings_contact_phone_check;
alter table public.bookings add constraint bookings_contact_phone_check
  check (char_length(btrim(contact_phone)) <= 40);

create or replace function private.create_booking(
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
    or p_contact_phone is null or char_length(btrim(p_contact_phone)) > 40
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

notify pgrst, 'reload schema';
