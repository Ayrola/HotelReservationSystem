-- Initial schema. Apply only through migration tooling, as the trusted database owner.
-- Guest booking/cancellation RPCs remain closed until their business rules are agreed.
create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 100),
  phone text check (char_length(phone) <= 40),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'guest' check (role in ('guest', 'admin'))
);

create table public.hotels (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  description text not null default '' check (char_length(description) <= 10000),
  city text not null check (char_length(btrim(city)) between 1 and 100),
  country text not null check (char_length(btrim(country)) between 1 and 100),
  address text not null check (char_length(btrim(address)) between 1 and 500),
  timezone text not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.room_types (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  description text not null default '' check (char_length(description) <= 10000),
  capacity integer not null check (capacity > 0),
  nightly_rate numeric(12,2) not null check (nightly_rate >= 0 and nightly_rate <> 'NaN'::numeric),
  currency text not null default 'EUR' check (currency = 'EUR'),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, hotel_id)
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  room_type_id uuid not null,
  -- Derived by trigger; the composite FK prevents cross-hotel inconsistency.
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  room_number text not null check (char_length(room_number) between 1 and 40 and room_number = btrim(room_number)),
  is_active boolean not null default false,
  foreign key (room_type_id, hotel_id) references public.room_types(id, hotel_id) on delete restrict,
  unique (hotel_id, room_number)
);

create table public.hotel_images (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete restrict,
  storage_path text not null unique check (
    char_length(storage_path) between 1 and 1000
    and storage_path !~ '(^/|(^|/)\.\.(/|$)|://)'
  ),
  alt_text text not null default '' check (char_length(alt_text) <= 500),
  position integer not null default 0 check (position >= 0),
  is_cover boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index hotel_images_one_cover_idx on public.hotel_images(hotel_id) where is_cover;

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  reference text not null default ('HB-' || upper(replace(gen_random_uuid()::text, '-', ''))) unique
    check (char_length(btrim(reference)) between 1 and 80),
  user_id uuid not null references auth.users(id) on delete restrict,
  room_id uuid not null references public.rooms(id) on delete restrict,
  check_in date not null check (isfinite(check_in)),
  check_out date not null check (isfinite(check_out)),
  guest_count integer not null check (guest_count > 0),
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  nightly_rate_snapshot numeric(12,2) not null check (nightly_rate_snapshot >= 0 and nightly_rate_snapshot <> 'NaN'::numeric),
  total_price numeric(12,2) not null check (total_price >= 0 and total_price <> 'NaN'::numeric),
  currency text not null default 'EUR' check (currency = 'EUR'),
  guest_name text not null check (char_length(btrim(guest_name)) between 1 and 200),
  contact_phone text not null check (char_length(btrim(contact_phone)) between 1 and 40),
  special_requests text not null default '' check (char_length(special_requests) <= 2000),
  hotel_name_snapshot text not null check (char_length(btrim(hotel_name_snapshot)) between 1 and 200),
  room_type_name_snapshot text not null check (char_length(btrim(room_type_name_snapshot)) between 1 and 200),
  request_id uuid not null,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  constraint bookings_valid_dates check (check_out > check_in),
  constraint bookings_total_matches_snapshot check (total_price = nightly_rate_snapshot * (check_out - check_in)),
  constraint bookings_cancellation_timestamp check (
    (status = 'confirmed' and cancelled_at is null)
    or (status = 'cancelled' and cancelled_at is not null and cancelled_at >= created_at)
  ),
  constraint bookings_user_request_unique unique (user_id, request_id),
  -- Checkout is exclusive. This constraint also arbitrates competing transactions.
  constraint bookings_no_overlapping_confirmed exclude using gist (
    room_id extensions.gist_uuid_ops with =,
    daterange(check_in, check_out, '[)') with &&
  ) where (status = 'confirmed')
);

create table public.booking_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete restrict,
  event_type text not null check (event_type in ('confirmed', 'cancelled')),
  created_at timestamptz not null default now(),
  details jsonb not null default '{}'::jsonb check (
    jsonb_typeof(details) = 'object'
    and details - array['from_status', 'to_status']::text[] = '{}'::jsonb
    and (not details ? 'from_status' or details->>'from_status' in ('confirmed', 'cancelled'))
    and (not details ? 'to_status' or details->>'to_status' in ('confirmed', 'cancelled'))
  )
);

create index hotels_public_location_idx on public.hotels(country, city) where is_active;
create index room_types_hotel_id_idx on public.room_types(hotel_id);
create index rooms_room_type_hotel_idx on public.rooms(room_type_id, hotel_id);
create index hotel_images_hotel_position_idx on public.hotel_images(hotel_id, position, id);
create index bookings_user_created_idx on public.bookings(user_id, created_at desc);
create index bookings_room_id_idx on public.bookings(room_id);
create index booking_events_booking_created_idx on public.booking_events(booking_id, created_at, id);
create index booking_events_actor_id_idx on public.booking_events(actor_id);

create function private.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and role = 'admin'
  );
$$;

create function private.maintain_updated_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at := clock_timestamp(); return new; end; $$;

create function private.validate_hotel_timezone()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if not exists (
    select 1 from pg_catalog.pg_timezone_names where name = new.timezone
      and (name = 'UTC' or (name like '%/%' and name !~ '^(posix|right)/'))
  ) then raise exception 'Hotel timezone must be a valid IANA timezone' using errcode = '23514'; end if;
  return new;
end;
$$;

create function private.set_room_hotel()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.room_type_id is distinct from old.room_type_id
    and exists (select 1 from public.bookings where room_id = old.id) then
    raise exception 'A room referenced by bookings cannot change room type' using errcode = '23514';
  end if;
  select hotel_id into new.hotel_id from public.room_types where id = new.room_type_id for share;
  if not found then raise exception 'Unknown room type' using errcode = '23503'; end if;
  return new;
end;
$$;

create function private.guard_capacity()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.capacity < old.capacity and exists (
    select 1 from public.bookings b join public.rooms r on r.id = b.room_id
    where r.room_type_id = old.id and b.status = 'confirmed' and b.guest_count > new.capacity
  ) then raise exception 'Capacity cannot invalidate confirmed reservations' using errcode = '23514'; end if;
  return new;
end;
$$;

create function private.guard_booking()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare catalog record;
begin
  if tg_op = 'DELETE' then
    raise exception 'Historical bookings cannot be deleted' using errcode = '23514';
  elsif tg_op = 'UPDATE' then
    if (to_jsonb(new) - array['status','cancelled_at']::text[]) is distinct from
       (to_jsonb(old) - array['status','cancelled_at']::text[]) then
      raise exception 'Reservation details and snapshots are immutable' using errcode = '23514';
    end if;
    if old.status <> 'confirmed' or new.status <> 'cancelled' then
      raise exception 'Only confirmed to cancelled is a supported transition' using errcode = '23514';
    end if;
    new.cancelled_at := clock_timestamp();
    return new;
  end if;
  select h.name as hotel_name, rt.name as type_name, rt.capacity, rt.nightly_rate,
         (h.is_active and rt.is_active and r.is_active) as active
    into catalog
    from public.rooms r join public.room_types rt on rt.id = r.room_type_id
      join public.hotels h on h.id = rt.hotel_id
    where r.id = new.room_id for share of h, rt, r;
  if not found then raise exception 'Unknown room' using errcode = '23503'; end if;
  if not catalog.active or new.guest_count > catalog.capacity then
    raise exception 'Room is inactive or capacity is insufficient' using errcode = '23514';
  end if;
  if new.status <> 'confirmed' then raise exception 'New bookings must be confirmed' using errcode = '23514'; end if;
  new.nightly_rate_snapshot := catalog.nightly_rate;
  new.total_price := catalog.nightly_rate * (new.check_out - new.check_in);
  new.hotel_name_snapshot := catalog.hotel_name;
  new.room_type_name_snapshot := catalog.type_name;
  new.currency := 'EUR';
  new.created_at := clock_timestamp();
  new.cancelled_at := null;
  return new;
end;
$$;

create function private.record_booking_event()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.booking_events(booking_id, actor_id, event_type, details)
  values (new.id, auth.uid(), new.status,
    case when tg_op = 'INSERT' then jsonb_build_object('to_status', new.status)
      else jsonb_build_object('from_status', old.status, 'to_status', new.status) end);
  return new;
end;
$$;

create function private.reject_event_changes()
returns trigger language plpgsql set search_path = ''
as $$ begin raise exception 'Booking events are append-only' using errcode = '23514'; end; $$;

create function private.initialize_auth_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles(id, display_name)
    values (new.id, left(coalesce(new.raw_user_meta_data->>'display_name', ''), 100))
    on conflict (id) do nothing;
  -- Never trust a role supplied through editable signup metadata.
  insert into public.user_roles(user_id, role) values (new.id, 'guest')
    on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles for each row execute function private.maintain_updated_at();
create trigger hotels_updated_at before update on public.hotels for each row execute function private.maintain_updated_at();
create trigger room_types_updated_at before update on public.room_types for each row execute function private.maintain_updated_at();
create trigger hotels_timezone before insert or update of timezone on public.hotels for each row execute function private.validate_hotel_timezone();
create trigger rooms_set_hotel before insert or update on public.rooms for each row execute function private.set_room_hotel();
create trigger room_types_capacity before update of capacity on public.room_types for each row execute function private.guard_capacity();
create trigger bookings_integrity before insert or update or delete on public.bookings for each row execute function private.guard_booking();
create trigger bookings_audit after insert or update on public.bookings for each row execute function private.record_booking_event();
create trigger booking_events_immutable before update or delete on public.booking_events for each row execute function private.reject_event_changes();
create trigger hotel_system_auth_user_created after insert on auth.users for each row execute function private.initialize_auth_user();

-- Backfill existing accounts without overwriting profiles or trusted roles.
insert into public.profiles(id, display_name)
  select id, left(coalesce(raw_user_meta_data->>'display_name', ''), 100) from auth.users
  on conflict (id) do nothing;
insert into public.user_roles(user_id, role)
  select id, 'guest' from auth.users on conflict (user_id) do nothing;

-- Revoke Supabase default table grants before granting the minimum API access.
revoke all on public.profiles, public.user_roles, public.hotels, public.room_types,
  public.rooms, public.hotel_images, public.bookings, public.booking_events from public, anon, authenticated;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.hotels enable row level security;
alter table public.room_types enable row level security;
alter table public.rooms enable row level security;
alter table public.hotel_images enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_events enable row level security;

grant select on public.hotels, public.room_types, public.hotel_images to anon, authenticated;
grant insert, update, delete on public.hotels, public.room_types, public.hotel_images to authenticated;
grant select, insert, update, delete on public.rooms to authenticated;
grant select on public.profiles, public.user_roles, public.bookings, public.booking_events to authenticated;
grant update (display_name, phone) on public.profiles to authenticated;

create policy profiles_read_own on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy roles_read_own on public.user_roles for select to authenticated using (user_id = (select auth.uid()));
create policy hotels_public_read on public.hotels for select to anon, authenticated using (is_active);
create policy room_types_public_read on public.room_types for select to anon, authenticated
  using (is_active and exists (select 1 from public.hotels h where h.id = hotel_id and h.is_active));
create policy images_public_read on public.hotel_images for select to anon, authenticated
  using (exists (select 1 from public.hotels h where h.id = hotel_id and h.is_active));
create policy bookings_read_own on public.bookings for select to authenticated using (user_id = (select auth.uid()));
create policy bookings_admin_read on public.bookings for select to authenticated using ((select private.is_admin()));
create policy events_admin_read on public.booking_events for select to authenticated using ((select private.is_admin()));

do $$
declare relation text;
begin
  foreach relation in array array['hotels','room_types','rooms','hotel_images'] loop
    execute format('create policy %I on public.%I for select to authenticated using ((select private.is_admin()))', relation || '_admin_read', relation);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select private.is_admin()))', relation || '_admin_insert', relation);
    execute format('create policy %I on public.%I for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()))', relation || '_admin_update', relation);
    execute format('create policy %I on public.%I for delete to authenticated using ((select private.is_admin()))', relation || '_admin_delete', relation);
  end loop;
end;
$$;

-- Explicit grants only. Private definer helpers cannot be invoked as API RPCs.
revoke all on function private.is_admin(), private.maintain_updated_at(), private.validate_hotel_timezone(),
  private.set_room_hotel(), private.guard_capacity(), private.guard_booking(), private.record_booking_event(),
  private.reject_event_changes(), private.initialize_auth_user() from public, anon, authenticated;
grant execute on function private.is_admin() to authenticated;

-- No direct reservation mutation grants for guests OR admins. Future narrow RPCs
-- must authorize ownership/roles and cancellation eligibility, and retain triggers.
-- Image metadata is protected here; Storage buckets/policies are a later migration.
