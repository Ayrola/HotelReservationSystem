import { element } from '../utils/dom.js';
import { createField } from './forms.js';
import { searchParameters, validateHotelSearch } from '../utils/hotel-search.js';

export function createHotelSearch({ onChange = () => {}, navigate = url => window.location.assign(url), allowUndated = false, validate = validateHotelSearch, onSubmit, showDestination = true } = {}) {
  const initial = new URLSearchParams(window.location.search);
  const definitions = [
    ['destination', 'Destination', 'text', 'City or destination. Leave blank to explore all hotels.'],
    ['checkIn', 'Check-in', 'date', 'Hotel-local arrival date.'],
    ['checkOut', 'Check-out', 'date', 'Stay for 1–30 nights. Check-out is exclusive.'],
    ['guests', 'Guests', 'number', 'One physical room per reservation.'],
  ];
  const fields = Object.fromEntries(definitions.map(([id, label, type, help]) => {
    const field = createField({ id, label, type, help, required: id === 'guests' || (!allowUndated && id !== 'destination') });
    field.input.value = initial.get(id) ?? (id === 'guests' ? '2' : '');
    if (id === 'guests') { field.input.min = '1'; field.input.step = '1'; }
    if (id === 'destination') field.input.maxLength = 100;
    return [id, field];
  }));
  const values = () => Object.fromEntries(Object.entries(fields).map(([name, { input }]) => [name, input.value]));
  const summary = element('p', { className: 'error-summary', role: 'alert', hidden: '' });
  const form = element('form', { className: 'hotel-search surface-panel', novalidate: '', 'aria-labelledby': 'search-heading' }, [
    element('h2', { id: 'search-heading', className: 'h4', text: 'Where would you like to stay?' }), summary,
    element('div', { className: 'search-fields' }, [...Object.entries(fields).filter(([name]) => showDestination || name !== 'destination').map(([,field]) => field.wrapper),
      element('button', { type: 'submit', className: 'btn btn-primary search-submit', text: 'Search hotels' })]),
  ]);
  form.addEventListener('input', () => { summary.hidden = true; onChange(values()); });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const errors = validate(values());
    if (showDestination && fields.destination.input.value.length > 100) errors.destination = 'Use at most 100 characters.';
    for (const [name, field] of Object.entries(fields)) field.setError(errors[name] ?? '');
    const names = Object.keys(errors); summary.hidden = names.length === 0;
    if (names.length) {
      summary.textContent = 'Please correct the highlighted search fields.';
      fields[names[0]].input.focus(); return;
    }
    if (onSubmit) onSubmit(values());
    else navigate(`/hotels/?${searchParameters(values())}`);
  });
  return { form, values, fields, summary };
}
