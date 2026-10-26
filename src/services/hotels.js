import { requireSupabaseClient } from './supabase-client.js';

export async function loadHotelDetails(id) {
  const client = requireSupabaseClient();
  const { data, error } = await client.from('hotels')
    .select('id,name,city,country,address,description,timezone,room_types(id,name,description,capacity,nightly_rate,currency,is_active),hotel_images(id,storage_path,alt_text,position,is_cover)')
    .eq('id',id).eq('is_active',true).eq('room_types.is_active',true).maybeSingle();
  if (error) throw new Error('Hotel details could not be loaded.');
  if (!data) return null;
  return { ...data, room_types: data.room_types.filter(type => type.is_active),
    images: data.hotel_images.sort((a,b) => Number(b.is_cover)-Number(a.is_cover) || a.position-b.position || a.id.localeCompare(b.id))
      .map(image => ({ ...image, url: hotelCoverUrl(client,image) })) };
}
export async function loadHotelAvailability(id, values) {
  const { data, error } = await requireSupabaseClient().rpc('get_availability', {
    p_hotel_id:id, p_check_in:values.checkIn,p_check_out:values.checkOut,p_guest_count:Number(values.guests),
  });
  if (error) throw new Error('Availability could not be checked.');
  return data ?? [];
}
export async function hasVerifiedGuest() {
  const { data, error } = await requireSupabaseClient().auth.getUser();
  if (error?.name === 'AuthSessionMissingError') return false;
  if (error) throw new Error('Your sign-in status could not be verified. Please try again.');
  return Boolean(data.user);
}

export function hotelCoverUrl(client, cover) {
  const bucket = import.meta.env.VITE_SUPABASE_HOTEL_IMAGES_BUCKET?.trim();
  return bucket && cover?.storage_path ? client.storage.from(bucket).getPublicUrl(cover.storage_path).data.publicUrl : null;
}

export async function searchHotels(values) {
  const client = requireSupabaseClient();
  const { data, error } = await client.rpc('search_hotels', {
    p_check_in: values.checkIn || null, p_check_out: values.checkOut || null,
    p_guests: Number(values.guests), p_destination: values.destination.trim(),
    p_max_price: values.maxPrice === '' ? null : values.maxPrice,
    p_sort: values.sort, p_page: Number(values.page), p_page_size: 12,
  });
  if (error) throw new Error('Hotel search is unavailable. Please try again.');
  return { ...data, hotels: data.hotels.map(hotel => ({ ...hotel, image: hotelCoverUrl(client, hotel.cover) })) };
}

export async function loadFeaturedHotels() {
  const client = requireSupabaseClient();
  const { data, error } = await client.from('hotels')
    .select('id,name,city,country,room_types(nightly_rate,currency,is_active),hotel_images(storage_path,alt_text,is_cover,position)')
    .eq('is_active', true).order('name').order('id').limit(3);
  if (error) throw new Error('Hotels could not be loaded. Please try again.');
  const bucket = import.meta.env.VITE_SUPABASE_HOTEL_IMAGES_BUCKET?.trim();
  return (data ?? []).map(hotel => {
    const rates = (hotel.room_types ?? []).filter(type => type.is_active && type.currency === 'EUR')
      .map(type => Number(type.nightly_rate)).filter(rate => Number.isFinite(rate) && rate >= 0);
    const cover = (hotel.hotel_images ?? []).find(image => image.is_cover);
    // A bucket must be explicitly configured. Do not invent Storage locations.
    const image = bucket && cover?.storage_path ? client.storage.from(bucket).getPublicUrl(cover.storage_path).data.publicUrl : null;
    return { id: hotel.id, title: hotel.name, destination: `${hotel.city}, ${hotel.country}`,
      nightlyPrice: rates.length ? Math.min(...rates) : null, image, imageAlt: cover?.alt_text || `${hotel.name} cover photograph` };
  });
}
