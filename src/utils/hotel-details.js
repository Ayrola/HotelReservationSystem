import { validateHotelSearch } from './hotel-search.js';

export function readHotelDetails(search) {
  const params = new URLSearchParams(search);
  const id = params.get('id') ?? '';
  const validId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) && params.getAll('id').length === 1;
  const values = { checkIn:params.get('checkIn') ?? '', checkOut:params.get('checkOut') ?? '', guests:params.get('guests') ?? '2' };
  return { id, validId, errors:validateDetailSelection(values), duplicateSelection: ['checkIn','checkOut','guests'].some(name => params.getAll(name).length > 1) };
}
export function validateDetailSelection(values) {
  const dated = Boolean(values.checkIn || values.checkOut);
  const errors = validateHotelSearch(dated ? values : { ...values, checkIn: '2030-01-01', checkOut: '2030-01-02' });
  if (Number(values.guests) > 2147483647) errors.guests = 'Guest count is too large.';
  return errors;
}
export function createRequestGuard() {
  let version = 0;
  return { invalidate: () => ++version, current: ticket => ticket === version };
}
export function eligibleRoomType(type, quote, values) {
  return Object.keys(validateHotelSearch(values)).length === 0 && Number(values.guests) <= type.capacity
    && quote?.room_type_id === type.id && Number(quote.available_rooms) > 0;
}
export function bookingDestination(hotelId, typeId, values, quote, authenticated) {
  const params = new URLSearchParams({ hotelId, roomTypeId: typeId, checkIn: values.checkIn,
    checkOut: values.checkOut, guests: values.guests, expectedNightlyRate: String(quote.nightly_rate),
    expectedTotalPrice: String(quote.total_price), currency: 'EUR' });
  const booking = `/booking/?${params}`;
  return authenticated ? booking : `/pages/login/?${new URLSearchParams({ next: booking })}`;
}
