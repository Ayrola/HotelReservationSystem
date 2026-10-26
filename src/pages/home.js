import { mountPageShell } from '../components/page.js';
import { element } from '../utils/dom.js';
import { createHotelSearch } from '../components/hotel-search.js';
import { createPublicHotelCard } from '../components/hotel-card.js';
import { createEmptyState, createSkeleton } from '../components/states.js';
import { hotelDetailsUrl } from '../utils/hotel-search.js';
import { loadFeaturedHotels } from '../services/hotels.js';
import '../styles/home.css';

mountPageShell();
const links = [];
const search = createHotelSearch({ onChange: values => {
  for (const { link, id } of links) link.href = hotelDetailsUrl(id, values);
} });
document.querySelector('#home-search').append(search.form);
const collection = document.querySelector('#featured-hotels');
const status = document.querySelector('#featured-status');
const retry = element('button', { className: 'btn btn-outline-primary mt-3', type: 'button', text: 'Try loading hotels again' });
retry.addEventListener('click', loadHotels);
async function loadHotels() {
  collection.setAttribute('aria-busy', 'true'); status.textContent = 'Loading featured hotels…';
  collection.replaceChildren(...Array.from({ length: 3 }, () => createSkeleton())); links.length = 0;
  try {
    const hotels = await loadFeaturedHotels();
    collection.replaceChildren(...hotels.map(hotel => {
      const card = createPublicHotelCard({ ...hotel, href: hotelDetailsUrl(hotel.id, search.values()) });
      links.push({ link: card.querySelector('[data-hotel-link]'), id: hotel.id }); return card;
    }));
    status.textContent = hotels.length ? `${hotels.length} featured hotel${hotels.length === 1 ? '' : 's'}.` : 'No active hotels to show yet.';
    if (!hotels.length) collection.append(createEmptyState({ title: 'Your next stay is on its way', description: 'There are no published hotels yet. Please check back later.' }));
  } catch {
    status.textContent = 'Featured hotels are currently unavailable.';
    collection.replaceChildren(createEmptyState({ title: 'We could not load hotels', description: 'Please try again. You can still enter your search above.' }), retry);
  } finally { collection.setAttribute('aria-busy', 'false'); }
}
await loadHotels();
