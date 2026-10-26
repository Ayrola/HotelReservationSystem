// Explicit UTC arithmetic counts calendar days; URL values remain original strings.
export function calendarDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return null;
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date.getTime() / 86400000 : null;
}
export function validateHotelSearch({ checkIn = '', checkOut = '', guests = '' }) {
  const errors = {}; const start = calendarDay(checkIn); const end = calendarDay(checkOut);
  if (start === null) errors.checkIn = 'Choose a valid check-in date.';
  if (end === null) errors.checkOut = 'Choose a valid check-out date.';
  if (start !== null && end !== null) {
    if (end <= start) errors.checkOut = 'Check-out must be after check-in.';
    else if (end - start > 30) errors.checkOut = 'Choose a stay of 1–30 nights.';
  }
  if (!/^[1-9]\d*$/.test(guests) || !Number.isSafeInteger(Number(guests))) errors.guests = 'Enter a positive whole number of guests.';
  return errors;
}
export function searchParameters(values) {
  const params = new URLSearchParams();
  for (const name of ['destination', 'checkIn', 'checkOut', 'guests']) {
    const value = values[name]?.trim(); if (value) params.set(name, value);
  }
  return params;
}
export function hotelDetailsUrl(id, values) {
  const params = new URLSearchParams({ id });
  for (const name of ['checkIn', 'checkOut']) if (calendarDay(values[name] ?? '') !== null) params.set(name, values[name]);
  if (/^[1-9]\d*$/.test(values.guests ?? '') && Number.isSafeInteger(Number(values.guests))) params.set('guests', values.guests);
  return `/hotel/?${params}`;
}
