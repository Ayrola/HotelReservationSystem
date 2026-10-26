-- Read-only hotel-level search. Filtering/counting precede pagination.
create function private.search_hotels(
  p_check_in date, p_check_out date, p_guests integer, p_destination text,
  p_max_price numeric, p_sort text, p_page integer, p_page_size integer
) returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare result jsonb; availability jsonb := '[]'::jsonb;
begin
  if p_guests is null or p_guests <= 0 or p_destination is null or char_length(p_destination) > 100
    or p_sort is null or p_sort not in ('price_asc','price_desc','name_asc','name_desc')
    or p_page is null or p_page not between 1 and 1000000
    or p_page_size is null or p_page_size not between 1 and 48
    or (p_max_price is not null and (p_max_price < 0 or p_max_price > 9999999999.99
      or p_max_price <> round(p_max_price,2))) then
    raise exception 'Invalid search filters or pagination' using errcode = '22023';
  end if;
  if p_check_in is not null or p_check_out is not null then
    perform private.validate_stay(p_check_in,p_check_out,p_guests);
    select coalesce(jsonb_agg(to_jsonb(a)),'[]'::jsonb) into availability
      from private.get_availability(p_check_in,p_check_out,p_guests,null,null) a
      where a.available_rooms > 0;
  end if;

  with types as materialized (
    -- Delegate dated inventory and exact quotes to the existing availability operation.
    select a.hotel_id, a.room_type_id, a.room_type_name, a.capacity, a.nightly_rate, a.total_price
      from jsonb_to_recordset(availability) as a(hotel_id uuid,room_type_id uuid,
        room_type_name text,capacity integer,nightly_rate numeric,total_price numeric)
    union all
    select rt.hotel_id,rt.id,rt.name,rt.capacity,rt.nightly_rate,null::numeric
      from public.room_types rt join public.hotels h on h.id=rt.hotel_id
      where p_check_in is null and rt.is_active and h.is_active and rt.capacity >= p_guests
  ), eligible_types as (
    select * from types where p_max_price is null or nightly_rate <= p_max_price
  ), summaries as (
    select hotel_id,min(nightly_rate) as nightly_rate,min(total_price) as total_price,
      jsonb_agg(jsonb_build_object('id',room_type_id,'name',room_type_name,'capacity',capacity,
        'nightly_rate',nightly_rate,'total_price',total_price) order by nightly_rate,room_type_id) as room_types
    from eligible_types group by hotel_id
  ), matches as materialized (
    select h.id,h.name,h.city,h.country,s.nightly_rate,s.total_price,coalesce(s.room_types,'[]'::jsonb) as room_types
    from public.hotels h left join summaries s on s.hotel_id=h.id
    where h.is_active
      and (p_check_in is null or s.hotel_id is not null)
      and (p_max_price is null or s.hotel_id is not null)
      and (btrim(p_destination) = '' or strpos(lower(h.city || ' ' || h.country || ' ' || h.name),lower(btrim(p_destination))) > 0)
  ), ranked as (
    select m.*,row_number() over(order by
      case when p_sort='price_asc' then nightly_rate end asc nulls last,
      case when p_sort='price_desc' then nightly_rate end desc nulls last,
      case when p_sort='name_desc' then lower(name) end desc,
      case when p_sort <> 'name_desc' then lower(name) end asc,id) as position
    from matches m
  ), page as (
    select * from ranked order by position limit p_page_size offset ((p_page-1)*p_page_size)
  )
  select jsonb_build_object('total_count',(select count(*) from matches),'page',p_page,'page_size',p_page_size,
    'dated',p_check_in is not null,'nights',p_check_out-p_check_in,'guests',p_guests,
    'hotels',coalesce((select jsonb_agg(jsonb_build_object(
      'id',p.id,'name',p.name,'city',p.city,'country',p.country,'nightly_rate',p.nightly_rate,
      'total_price',p.total_price,'room_types',p.room_types,'cover',
      (select jsonb_build_object('storage_path',i.storage_path,'alt_text',i.alt_text)
        from public.hotel_images i where i.hotel_id=p.id and i.is_cover)
    ) order by p.position) from page p),'[]'::jsonb)) into result;
  return result;
end;
$$;

create function public.search_hotels(
  p_check_in date default null,p_check_out date default null,p_guests integer default 2,
  p_destination text default '',p_max_price numeric default null,p_sort text default 'price_asc',
  p_page integer default 1,p_page_size integer default 12
) returns jsonb language sql stable security invoker set search_path = ''
as $$ select private.search_hotels(p_check_in,p_check_out,p_guests,p_destination,p_max_price,p_sort,p_page,p_page_size); $$;
revoke all on function private.search_hotels(date,date,integer,text,numeric,text,integer,integer),
  public.search_hotels(date,date,integer,text,numeric,text,integer,integer) from public,anon,authenticated;
grant execute on function private.search_hotels(date,date,integer,text,numeric,text,integer,integer),
  public.search_hotels(date,date,integer,text,numeric,text,integer,integer) to anon,authenticated;
notify pgrst,'reload schema';
