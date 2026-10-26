import { mountPageShell } from '../components/page.js';
import { createHotelSearch } from '../components/hotel-search.js';
import { createHotelGallery } from '../components/hotel-gallery.js';
import { createRoomTypeCard } from '../components/room-type-card.js';
import { createEmptyState, createSkeleton } from '../components/states.js';
import { element } from '../utils/dom.js';
import { readHotelDetails, validateDetailSelection, createRequestGuard, bookingDestination } from '../utils/hotel-details.js';
import { loadHotelDetails, loadHotelAvailability, hasVerifiedGuest } from '../services/hotels.js';
import '../styles/home.css';
import '../styles/hotel-details.css';
import { initializeSessionNavigation } from './session.js';

mountPageShell();
initializeSessionNavigation();
const content = document.querySelector('#page-content');
const selection = readHotelDetails(window.location.search);
const guard = createRequestGuard();
let timer;

function unavailable() {
  document.querySelector('h1').textContent = 'Hotel not available';
  content.replaceChildren(createEmptyState({ title:'We could not find this hotel',description:'It may be unpublished or the link may be incomplete.' }),
    element('a', { href:'/hotels/',className:'btn btn-outline-primary mt-3',text:'Explore hotels' }));
}

async function initialize() {
  content.setAttribute('aria-busy','true');
  if (!selection.validId) { unavailable(); content.setAttribute('aria-busy','false'); return; }
  content.replaceChildren(createSkeleton({ label:'Loading property details' }));
  try {
    const hotel = await loadHotelDetails(selection.id);
    if (!hotel) { unavailable(); return; }
    document.title = `${hotel.name} | Staywell`;
    document.querySelector('h1').textContent = hotel.name;
    document.querySelector('#property-location').textContent = `${hotel.city}, ${hotel.country}`;
    document.querySelector('#property-address').textContent = hotel.address;
    const status = element('p', { role:'status','aria-live':'polite',className:'mt-3' });
    const rooms = hotel.room_types.map(type => ({ type,...createRoomTypeCard(type) }));
    let search;
    function reset(values,phase) { for (const room of rooms) room.update({ values,phase }); }
    async function check(values,ticket) {
      const errors = validateDetailSelection(values);
      for (const [name,field] of Object.entries(search.fields)) field.setError(errors[name] ?? '');
      search.summary.hidden = !Object.keys(errors).length;
      if (Object.keys(errors).length) {
        search.summary.textContent = 'Correct the dates and guest count to check availability.';
        status.textContent = 'No current quote. Your inputs have been preserved.';
        reset(values,'invalid'); return;
      }
      const url = new URL(window.location.href);
      for (const name of ['checkIn','checkOut','guests']) {
        url.searchParams.delete(name);
        if (values[name]) url.searchParams.set(name,values[name]);
      }
      history.replaceState(null,'',url);
      if (!values.checkIn && !values.checkOut) {
        status.textContent = 'Indicative catalog rates only. Select dates to check availability.';
        reset(values,'indicative'); return;
      }
      status.textContent = 'Checking availability…'; reset(values,'loading');
      try {
        const quotes = await loadHotelAvailability(hotel.id,values);
        if (!guard.current(ticket)) return;
        status.textContent = `Availability checked for ${values.checkIn} to ${values.checkOut} · ${values.guests} guests. Availability can change before booking.`;
        for (const room of rooms) {
          const quote = quotes.find(item => item.room_type_id===room.type.id);
          room.update({ values,quote,phase:'quoted',onReserve:async () => {
            room.reserve.disabled = true;
            try {
              const authenticated = await hasVerifiedGuest();
              if (!guard.current(ticket)) return;
              window.location.assign(bookingDestination(hotel.id,room.type.id,values,quote,authenticated));
            } catch {
              if (!guard.current(ticket)) return;
              status.textContent = 'Sign-in status could not be verified. Please try Reserve again.';
              room.reserve.disabled = false;
            }
          } });
        }
      } catch {
        if (!guard.current(ticket)) return;
        status.textContent = 'Availability could not be checked. Use Check availability to try again.';
        reset(values,'error');
      }
    }
    function schedule(values,delay=250) {
      clearTimeout(timer);
      const ticket = guard.invalidate();
      reset(values,'loading'); status.textContent = 'Updating your selection…';
      timer = setTimeout(() => check(values,ticket),delay);
    }
    search = createHotelSearch({ showDestination:false,allowUndated:true,validate:validateDetailSelection,
      onChange:values => schedule(values),onSubmit:values => schedule(values,0) });
    search.form.classList.add('detail-search');
    search.form.querySelector('h2').textContent = 'Check your stay';
    search.form.querySelector('button[type=submit]').textContent = 'Check availability';
    search.fields.checkIn.input.setAttribute('aria-describedby',`${search.fields.checkIn.input.getAttribute('aria-describedby')} hotel-date-note`);
    search.form.append(element('p', { id:'hotel-date-note',className:'small text-muted mt-3',text:`Dates use ${hotel.timezone} hotel-local calendar days. Leave both dates blank for indicative rates. Stays are 1–30 nights.` }));
    content.replaceChildren(
      element('section', { 'aria-labelledby':'gallery-heading' }, [element('h2', { id:'gallery-heading',text:'Property photographs' }),createHotelGallery(hotel.images,hotel.name)]),
      element('section', { className:'section-space','aria-labelledby':'description-heading' }, [element('h2', { id:'description-heading',text:'About this property' }),
        element('p', { className:'property-description',text:hotel.description || 'No property description has been provided.' })]),
      search.form,status,
      element('section', { className:'section-space','aria-labelledby':'rooms-heading' }, [element('h2', { id:'rooms-heading',text:'Room types' }),
        element('p', { className:'section-description',text:'One physical room per reservation. Prices in EUR; pay at the hotel. Sign in to continue. The booking screen is still being connected; Reserve does not yet create a reservation.' }),
        rooms.length ? element('div', { className:'card-grid' }, rooms.map(room => room.card)) : createEmptyState({ title:'No published room types',description:'Please check back later.' })])
    );
    if (selection.duplicateSelection || Object.keys(selection.errors).length) {
      reset(search.values(),'invalid'); search.summary.hidden = false;
      search.summary.textContent = selection.duplicateSelection ? 'Repeated selection parameters are invalid. Review the fields and check availability again.' : Object.values(selection.errors).join(' ');
      for (const [name,field] of Object.entries(search.fields)) field.setError(selection.errors[name] ?? '');
      status.textContent = 'No current quote.';
    } else schedule(search.values(),0);
  } catch {
    const retry = element('button', { className:'btn btn-outline-primary mt-3',type:'button',text:'Try loading this hotel again' });
    retry.addEventListener('click',initialize);
    content.replaceChildren(createEmptyState({ title:'Hotel details could not be loaded',description:'Please try again.' }),retry);
  } finally { content.setAttribute('aria-busy','false'); }
}
await initialize();
