import { element, icon, safeImageUrl } from '../utils/dom.js';

export function createHotelCard({ title, description, image, imageAlt, nightlyPrice = null, placeholder = true }) {
  const price = nightlyPrice !== null && Number.isFinite(nightlyPrice)
    ? `${new Intl.NumberFormat('en', { style: 'currency', currency: 'EUR' }).format(nightlyPrice)} / night`
    : 'Price to be confirmed';
  return element('article', { className: 'hotel-card' }, [
    element('div', { className: 'hotel-card-image' }, [
      element('img', { src: safeImageUrl(image), alt: imageAlt, loading: 'lazy', width: '800', height: '600' }),
      ...(placeholder ? [element('span', { className: 'badge badge-surface', text: 'Placeholder property' })] : []),
    ]),
    element('div', { className: 'hotel-card-body' }, [
      element('p', { className: 'card-kicker' }, [icon('geo-alt'), document.createTextNode(' Illustrative stay')]),
      element('h3', { className: 'h4', text: title }),
      element('p', { className: 'text-muted', text: description }),
      element('div', { className: 'card-price' }, [element('strong', { text: price }), element('small', { text: 'EUR · Pay at the hotel' })]),
      element('p', { className: 'small text-muted mb-0', text: 'Photography is illustrative. No availability is offered.' }),
    ]),
  ]);
}
