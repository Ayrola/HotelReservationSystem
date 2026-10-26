import { element, icon, safeImageUrl } from '../utils/dom.js';

export function createPublicHotelCard({ title, destination, image, imageAlt, nightlyPrice, href, dated = false }) {
  const fallback = element('p', { className: 'hotel-image-fallback', text: 'Property photo unavailable' });
  const media = element('div', { className: 'hotel-card-image' }, [fallback]);
  if (image) {
    let src = '';
    try { src = safeImageUrl(image); } catch { /* fallback remains visible */ }
    if (src) {
      const photo = element('img', { src, alt: imageAlt, loading: 'lazy', width: '800', height: '600', style: 'position:absolute;inset:0;opacity:0' });
      photo.addEventListener('load', () => { photo.style.opacity = '1'; fallback.hidden = true; });
      photo.addEventListener('error', () => { photo.remove(); fallback.hidden = false; });
      media.append(photo);
    }
  }
  const price = nightlyPrice !== null && Number.isFinite(nightlyPrice)
    ? `From ${new Intl.NumberFormat('en', { style: 'currency', currency: 'EUR' }).format(nightlyPrice)} / night` : 'Nightly price not available';
  return element('article', { className: 'hotel-card' }, [media,
    element('div', { className: 'hotel-card-body' }, [
      element('p', { className: 'card-kicker' }, [icon('geo-alt'), document.createTextNode(` ${destination}`)]),
      element('h3', { className: 'h4' }, [element('a', { href, text: title, 'data-hotel-link': '' })]),
      element('div', { className: 'card-price' }, [element('strong', { text: price }), element('small', { text: dated ? 'Available room-type rate · EUR · Pay at the hotel' : 'Indicative catalog price · EUR · Pay at the hotel' })]),
      element('p', { className: 'small text-muted mb-0', text: dated ? 'Availability is checked again when you book.' : 'Check your dates and guests for availability and the final price.' }),
    ]),
  ]);
}

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
