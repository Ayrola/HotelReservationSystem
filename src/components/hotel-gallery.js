import { element, safeImageUrl } from '../utils/dom.js';

export function createHotelGallery(images, hotelName) {
  const gallery = element('div', { className: 'property-gallery' });
  for (const [index,image] of images.entries()) {
    let src;
    try { src = image.url ? safeImageUrl(image.url) : ''; } catch { src = ''; }
    if (!src) continue;
    const fallback = element('p', { className: 'gallery-fallback', text: 'This property photo is unavailable.' });
    const photo = element('img', { src, alt:image.alt_text || `${hotelName} property photograph ${index+1}`, width:'900',height:'600',loading:'lazy' });
    const link = element('a', { href:src,target:'_blank',rel:'noopener noreferrer', 'aria-label':`Open property photo ${index+1} in a new tab` }, [photo]);
    photo.addEventListener('error', () => link.replaceWith(fallback), { once:true });
    gallery.append(element('figure', {}, [link,element('figcaption', { text:`Photo ${index+1} · Open full image in a new tab` })]));
  }
  if (!gallery.childElementCount) gallery.append(element('p', { className:'preview-notice',text:'Property photographs are not available yet.' }));
  return gallery;
}
