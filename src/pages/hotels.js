import { mountPageShell } from '../components/page.js';
import { createHotelSearch } from '../components/hotel-search.js';
import { createField } from '../components/forms.js';
import { createPublicHotelCard } from '../components/hotel-card.js';
import { createEmptyState, createSkeleton } from '../components/states.js';
import { element } from '../utils/dom.js';
import { hotelSorts, readHotelResults, validateHotelResults, hotelResultsUrl, hotelResultDetailsUrl } from '../utils/hotel-results.js';
import { searchHotels } from '../services/hotels.js';
import '../styles/home.css';
import '../styles/hotel-results.css';

mountPageShell();
const { values, errors } = readHotelResults(window.location.search);
const status = document.querySelector('#results-status');
const results = document.querySelector('#hotel-results');
const pagination = document.querySelector('#results-pagination');
const maxPrice = createField({ id: 'maxPrice', label: 'Maximum nightly price (EUR)', type: 'number', help: 'Optional. Applies to matching room types before pagination.' });
maxPrice.input.min = '0'; maxPrice.input.step = '0.01'; maxPrice.input.value = values.maxPrice;
const sort = element('select', { id: 'sort', className: 'form-select' }, Object.entries(hotelSorts).map(([value, text]) => element('option', { value, text })));
sort.value = values.sort;
const filters = () => ({ maxPrice: maxPrice.input.value, sort: sort.value, page: '1' });
const search = createHotelSearch({ allowUndated: true,
  validate: input => {
    const validation = validateHotelResults({ ...input, ...filters() });
    return Object.fromEntries(Object.entries(validation).filter(([name]) => Object.hasOwn(search.fields, name)));
  },
  onSubmit: input => {
    const next = { ...input, ...filters() };
    const validation = validateHotelResults(next);
    maxPrice.setError(validation.maxPrice ?? '');
    sort.setAttribute('aria-invalid', String(Boolean(validation.sort)));
    if (Object.keys(validation).length) {
      search.summary.hidden = false; search.summary.textContent = 'Please correct the highlighted filters.';
      (validation.maxPrice ? maxPrice.input : sort).focus(); return;
    }
    window.location.assign(hotelResultsUrl(next));
  },
});
search.form.querySelector('#checkIn-help').textContent = 'Leave both dates blank to browse without an availability claim.';
search.form.append(element('div', { className: 'results-filters' }, [maxPrice.wrapper,
  element('div', { className: 'form-field' }, [element('label', { for: 'sort', className: 'form-label', text: 'Sort hotels' }), sort]) ]));
document.querySelector('#results-search').append(search.form);

const money = value => new Intl.NumberFormat('en', { style: 'currency', currency: 'EUR' }).format(Number(value));
function resultCard(hotel, response) {
  const href = hotelResultDetailsUrl(hotel.id, values);
  const card = createPublicHotelCard({ title: hotel.name, destination: `${hotel.city}, ${hotel.country}`, image: hotel.image,
    imageAlt: hotel.cover?.alt_text || `${hotel.name} cover photograph`, nightlyPrice: hotel.nightly_rate === null ? null : Number(hotel.nightly_rate), href, dated: response.dated });
  const body = card.querySelector('.hotel-card-body');
  body.append(element('h4', { className: 'h6 mt-3', text: response.dated ? 'Available room types' : 'Indicative room types' }));
  if (!hotel.room_types.length) body.append(element('p', { text: 'No published room-type rates for this guest count.' }));
  else body.append(element('ul', { className: 'room-type-summary' }, hotel.room_types.map(type => element('li', {
    text: `${type.name} · up to ${type.capacity} guests · ${money(type.nightly_rate)} / night${response.dated ? ` · ${money(type.total_price)} total` : ''}`,
  }))));
  if (response.dated) body.append(element('p', { className: 'fw-semibold', text: `${response.nights} night${response.nights === 1 ? '' : 's'} · ${response.guests} guest${response.guests === 1 ? '' : 's'} · Stay from ${money(hotel.total_price)}` }));
  body.append(element('a', { href, className: 'btn btn-outline-primary mt-3', text: 'View Hotel', 'aria-label': `View Hotel: ${hotel.name}` }));
  return card;
}
async function load() {
  results.setAttribute('aria-busy','true'); status.textContent = 'Loading hotels…'; pagination.replaceChildren();
  results.replaceChildren(...Array.from({ length: 3 }, () => createSkeleton()));
  try {
    const response = await searchHotels(values);
    const total = Number(response.total_count); const pages = Math.ceil(total / response.page_size);
    status.textContent = `${total} matching hotel${total === 1 ? '' : 's'}. ${response.dated ? `${response.nights} nights · ${response.guests} guests. Availability can change before booking.` : `Catalog prices for ${response.guests} guests. Enter dates to check availability.`}`;
    results.replaceChildren(...response.hotels.map(hotel => resultCard(hotel,response)));
    if (!response.hotels.length) results.append(createEmptyState({ title: total ? 'This results page is empty' : 'No matching hotels', description: total ? 'Choose the first page below or edit your search.' : 'Try another destination, budget, date range or guest count.' }));
    if (Number(values.page) > 1) pagination.append(element('a', { href: hotelResultsUrl(values), className: 'btn btn-outline-primary', text: 'First page' }));
    if (Number(values.page) > 1 && Number(values.page) <= pages) pagination.append(element('a', { href: hotelResultsUrl(values,String(Number(values.page)-1)), className: 'btn btn-outline-primary', text: 'Previous' }));
    if (total) pagination.append(element('span', { text: `Page ${values.page} · ${pages} page${pages === 1 ? '' : 's'}` }));
    if (Number(values.page) < pages) pagination.append(element('a', { href: hotelResultsUrl(values,String(Number(values.page)+1)), className: 'btn btn-outline-primary', text: 'Next' }));
  } catch {
    status.textContent = 'Hotel results could not be loaded.';
    const retry = element('button', { className: 'btn btn-outline-primary mt-3', type: 'button', text: 'Try again' });
    retry.addEventListener('click',load);
    results.replaceChildren(createEmptyState({ title: 'Search is temporarily unavailable', description: 'Retry or edit your search above.' }), retry);
  } finally { results.setAttribute('aria-busy','false'); }
}
if (Object.keys(errors).length) {
  status.textContent = 'Invalid search. Correct the fields above and search again.';
  search.summary.hidden = false; search.summary.textContent = Object.values(errors).join(' ');
  for (const [name, field] of Object.entries(search.fields)) field.setError(errors[name] ?? '');
  maxPrice.setError(errors.maxPrice ?? '');
  sort.setAttribute('aria-invalid', String(Boolean(errors.sort)));
} else await load();
