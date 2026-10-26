import { requireSupabaseClient } from './supabase-client.js';
import { getVerifiedUser } from './auth.js';

const savedFields='id,reference,status,check_in,check_out,guest_count,nightly_rate_snapshot,total_price,currency,hotel_name_snapshot,room_type_name_snapshot,cancelled_at';
async function verifyOwner(userId) {
  const user=await getVerifiedUser();
  if (!user || user.id!==userId) throw new Error('Sign in to the original booking account.');
}
export async function getBookingQuote(values) {
  const {data,error}=await requireSupabaseClient().rpc('get_availability',{
    p_room_type_id:values.roomTypeId,p_hotel_id:values.hotelId || null,
    p_check_in:values.checkIn,p_check_out:values.checkOut,p_guest_count:Number(values.guests),
  }).abortSignal(AbortSignal.timeout(15000));
  if(error) throw new Error('Quote unavailable.');
  return data?.[0] ?? null;
}
export async function getBookingGuest(userId) {
  const {data,error}=await requireSupabaseClient().from('profiles').select('display_name,phone').eq('id',userId).maybeSingle();
  if(error) return null;
  return data;
}
export async function createBooking(userId,payload,requestId) {
  await verifyOwner(userId);
  // No owner ID or trusted total is submitted. RPC derives ownership and prices.
  const {data,error}=await requireSupabaseClient().rpc('create_booking',{...payload,p_request_id:requestId})
    .abortSignal(AbortSignal.timeout(15000));
  if(error) {
    const failure=new Error('Booking request failed.');
    failure.definitive=['22023','22003','23514','23503'].includes(error.code);
    throw failure;
  }
  return data;
}
export async function reconcileBooking(userId,requestId) {
  await verifyOwner(userId);
  const {data,error}=await requireSupabaseClient().from('bookings').select(savedFields)
    .eq('user_id',userId).eq('request_id',requestId).maybeSingle().abortSignal(AbortSignal.timeout(15000));
  if(error) throw new Error('Booking status could not be checked.');
  return data;
}
export async function loadSavedBooking(userId,id) {
  const {data,error}=await requireSupabaseClient().from('bookings').select(savedFields)
    .eq('user_id',userId).eq('id',id).maybeSingle();
  if(error) throw new Error('Booking could not be loaded.');
  return data;
}
export function watchBookingIdentity(userId,onLost) {
  // Session fields can revoke access immediately; they are never used to grant it.
  const {data}=requireSupabaseClient().auth.onAuthStateChange((event,session)=>{
    if(event==='SIGNED_OUT' || (session && session.user.id!==userId)) setTimeout(onLost,0);
  });
  return ()=>data.subscription.unsubscribe();
}
