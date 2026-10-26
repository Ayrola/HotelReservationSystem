import { element } from '../utils/dom.js';
import { eligibleRoomType } from '../utils/hotel-details.js';

const money = value => new Intl.NumberFormat('en',{ style:'currency',currency:'EUR' }).format(Number(value));
export function createRoomTypeCard(type) {
  const state = element('p', { className:'room-quote',role:'status' });
  const reserve = element('button', { className:'btn btn-primary',type:'button',text:'Reserve',disabled:'' });
  const card = element('article', { className:'surface-panel room-type-card' }, [
    element('h3', { className:'h4',text:type.name }),
    element('p', { className:'property-description',text:type.description || 'No room-type description has been provided.' }),
    element('p', { text:`Capacity: up to ${type.capacity} guest${type.capacity===1?'':'s'} · one room` }),
    element('p', { text:`Indicative catalog rate: ${money(type.nightly_rate)} / night` }),state,reserve,
  ]);
  function update({ values, quote, phase, onReserve }) {
    reserve.disabled = true; reserve.onclick = null;
    if (Number(values.guests)>type.capacity) state.textContent = 'This room type does not fit your guest count.';
    else if (phase==='loading') state.textContent = 'Checking your selected dates…';
    else if (phase==='error') state.textContent = 'Availability is unknown. Try checking again.';
    else if (phase==='invalid') state.textContent = 'Correct the dates and guest count to get a quote.';
    else if (phase!=='quoted') state.textContent = 'Select dates to check availability and a stay total.';
    else if (!eligibleRoomType(type,quote,values)) state.textContent = 'Unavailable for these dates and guests.';
    else {
      state.textContent = `Current stay quote: ${money(quote.nightly_rate)} / night · ${quote.nights} night${quote.nights===1?'':'s'} · ${values.guests} guests · ${money(quote.total_price)} total. EUR · Pay at the hotel.`;
      reserve.disabled = false; reserve.onclick = onReserve;
    }
  }
  return { card,update,reserve };
}
