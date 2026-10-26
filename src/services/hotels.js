import { requireSupabaseClient } from './supabase-client.js';

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
