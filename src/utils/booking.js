import { validateHotelSearch } from './hotel-search.js';
export const isUuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value ?? '');
export function readBookingSelection(search) {
  const params = new URLSearchParams(search);
  const values = Object.fromEntries(['hotelId','roomTypeId','checkIn','checkOut','guests'].map(name=>[name,params.get(name) ?? '']));
  const errors = validateHotelSearch(values);
  if (!isUuid(values.roomTypeId)) errors.roomTypeId = 'Choose a valid room type.';
  if (values.hotelId && !isUuid(values.hotelId)) errors.hotelId = 'Choose a valid hotel.';
  if (Number(values.guests)>2147483647) errors.guests = 'Guest count is too large.';
  if (Object.keys(values).some(name=>params.getAll(name).length>1)) errors.parameters = 'Repeated booking parameters are invalid.';
  return { values,errors };
}
export function validateBookingGuest({ guestName,phone,specialRequests }) {
  const errors = {};
  if (!guestName.trim() || guestName.trim().length>200) errors.guestName = 'Enter a guest name of 1–200 characters.';
  if (phone.trim().length>40) errors.phone = 'Use at most 40 characters for the phone number.';
  if (specialRequests.length>2000) errors.specialRequests = 'Use at most 2,000 characters.';
  return errors;
}
export function bookingPayload(values,quote,guest) {
  return { p_room_type_id:values.roomTypeId,p_check_in:values.checkIn,p_check_out:values.checkOut,
    p_guest_count:Number(values.guests),p_guest_name:guest.guestName.trim(),p_contact_phone:guest.phone.trim(),
    p_special_requests:guest.specialRequests,p_expected_nightly_rate:quote.nightly_rate,p_expected_total_price:quote.total_price };
}
export function restoreBookingAttempt(raw) {
  if (!raw) return null;
  const saved = JSON.parse(raw); const p = saved.payload;
  if (!isUuid(saved.id) || !p) throw new Error('Invalid saved request.');
  const selection = readBookingSelection(new URLSearchParams({ roomTypeId:p.p_room_type_id,
    checkIn:p.p_check_in,checkOut:p.p_check_out,guests:String(p.p_guest_count) }).toString());
  if (Object.keys(selection.errors).length || typeof p.p_guest_name!=='string' || typeof p.p_contact_phone!=='string' || typeof p.p_special_requests!=='string'
    || Object.keys(validateBookingGuest({guestName:p.p_guest_name,phone:p.p_contact_phone,specialRequests:p.p_special_requests})).length
    || [p.p_expected_nightly_rate,p.p_expected_total_price].some(value=>!/^\d+(\.\d{1,2})?$/.test(String(value)) || Number(value)>9999999999.99)) throw new Error('Invalid saved request.');
  // Reconstruct the allowlisted payload; never forward user IDs or extra stored fields.
  return { id:saved.id,payload:bookingPayload(selection.values,{nightly_rate:p.p_expected_nightly_rate,total_price:p.p_expected_total_price},
    {guestName:p.p_guest_name,phone:p.p_contact_phone,specialRequests:p.p_special_requests}),review:saved.review ?? null };
}
export function pendingSelection(attempt) {
  const p=attempt.payload;
  return { roomTypeId:p.p_room_type_id,checkIn:p.p_check_in,checkOut:p.p_check_out,guests:String(p.p_guest_count),hotelId:'' };
}
