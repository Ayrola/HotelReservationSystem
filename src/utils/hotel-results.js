import { validateHotelSearch, searchParameters } from './hotel-search.js';

export const hotelSorts = { price_asc: 'Price: low to high', price_desc: 'Price: high to low', name_asc: 'Name: A–Z', name_desc: 'Name: Z–A' };
export function validateHotelResults(values) {
  const dated = Boolean(values.checkIn || values.checkOut);
  const errors = validateHotelSearch(dated ? values : { ...values, checkIn: '2030-01-01', checkOut: '2030-01-02' });
  if (Number(values.guests) > 2147483647) errors.guests = 'Guest count is too large.';
  if ((values.destination ?? '').length > 100) errors.destination = 'Use at most 100 characters.';
  if (values.maxPrice && (!/^\d+(\.\d{1,2})?$/.test(values.maxPrice) || Number(values.maxPrice) > 9999999999.99)) errors.maxPrice = 'Enter a nonnegative EUR price with at most two decimal places.';
  if (!Object.hasOwn(hotelSorts, values.sort)) errors.sort = 'Choose a supported sort order.';
  if (!/^[1-9]\d*$/.test(values.page) || Number(values.page) > 1000000) errors.page = 'Choose a valid results page.';
  return errors;
}
export function readHotelResults(search) {
  const params = new URLSearchParams(search);
  const values = Object.fromEntries(['destination','checkIn','checkOut','guests','maxPrice','sort','page'].map(name => [name, params.get(name) ?? ({ guests: '2', sort: 'price_asc', page: '1' }[name] ?? '')]));
  const errors = validateHotelResults(values);
  if ([...params.keys()].some(name => params.getAll(name).length > 1)) errors.parameters = 'Repeated search parameters are not supported.';
  return { values, errors };
}
export function hotelResultsUrl(values, page = '1') {
  const params = searchParameters(values);
  for (const name of ['maxPrice','sort']) if (values[name]) params.set(name, values[name]);
  if (page !== '1') params.set('page', page);
  return `/hotels/?${params}`;
}
export function hotelResultDetailsUrl(id, values) {
  const params = new URLSearchParams(hotelResultsUrl(values, values.page).split('?')[1]);
  params.set('id', id);
  return `/pages/hotel/?${params}`;
}
