import { element, icon } from '../utils/dom.js';
import { createSection } from './layout.js';
import { createHotelCard } from './hotel-card.js';
import { createEmptyState, createSkeleton } from './states.js';
import { createField, validateFields } from './forms.js';
import { confirmAction } from './confirmation-dialog.js';
import { showToast } from './toast.js';

export function createHotelCollection() {
  const cards = [
    { title: 'A slower pace', description: 'A poolside retreat, shown as a visual example.', image: '/images/hotel-pool.jpg', imageAlt: 'Illustrative resort pool surrounded by palms' },
    { title: 'Room to unwind', description: 'A restful room, shown as a visual example.', image: '/images/hotel-room.jpg', imageAlt: 'Illustrative hotel bedroom with soft lighting' },
    { title: 'A different perspective', description: 'An architectural escape, shown as a visual example.', image: '/images/hotel-exterior.jpg', imageAlt: 'Illustrative hotel exterior and landscaped grounds' },
  ];
  return createSection({ eyebrow: 'A sense of place', title: 'Picture your next escape', id: 'collection-title', description: 'Design preview only. These are illustrative stays, not real hotel listings. Prices and availability will come from verified hotel data.' }, [
    element('div', { className: 'card-grid' }, cards.map(createHotelCard)),
  ]);
}

export function createHero(heading) {
  heading.textContent = 'Find your kind of somewhere.';
  return element('section', { className: 'hero', 'aria-label': 'Welcome to Staywell' }, [
    element('img', { className: 'hero-image', src: '/images/hotel-pool.jpg', alt: '', width: '1800', height: '1200', fetchpriority: 'high' }),
    element('div', { className: 'page-container hero-content' }, [
      element('p', { className: 'eyebrow', text: 'A change of scene' }), heading,
      element('p', { text: 'From a quiet morning by the pool to a room with a different view. Make space for your next escape.' }),
      element('a', { className: 'btn btn-primary mt-3', href: '/pages/hotels/', text: 'Explore the hotel preview' }),
      element('p', { className: 'photo-caption', text: 'Illustrative photography · Platform preview · Booking is not yet available' }),
    ]),
  ]);
}

export function createFeatureStrip() {
  return element('div', { className: 'feature-strip' }, [
    element('span', {}, [icon('currency-euro'), document.createTextNode('Prices in EUR')]),
    element('span', {}, [icon('credit-card'), document.createTextNode('Pay at the hotel')]),
    element('span', {}, [icon('door-open'), document.createTextNode('One room per reservation')]),
  ]);
}

export function createDesignPreview() {
  const notification = element('button', { type: 'button', className: 'btn btn-outline-primary', text: 'Preview notification' });
  notification.addEventListener('click', () => showToast('Preview notification. No reservation has been created.'));
  const confirmation = element('button', { type: 'button', className: 'btn btn-primary', text: 'Preview confirmation dialog' });
  confirmation.addEventListener('click', async () => {
    const confirmed = await confirmAction({ title: 'Preview this confirmation?', message: 'This is a design example. Confirming does not create or cancel a reservation.', confirmLabel: 'Confirm preview', cancelLabel: 'Close preview' });
    if (confirmed) showToast('Confirmation preview completed. No data was changed.');
  });
  const disabled = element('button', { type: 'button', className: 'btn btn-primary', text: 'Unavailable action', disabled: '' });
  const controls = element('div', { className: 'surface-panel' }, [
    element('h3', { className: 'h5', text: 'Buttons & feedback' }),
    element('p', { className: 'text-muted', text: 'Interactive design examples only; no booking actions.' }),
    element('div', { className: 'button-row' }, [confirmation, notification, disabled]),
    element('div', { className: 'button-row mt-4' }, [element('span', { className: 'badge badge-soft', text: 'Placeholder' }), element('span', { className: 'badge badge-soft', text: 'Pay at hotel' })]),
  ]);
  const email = createField({ id: 'preview-email', label: 'Email address', type: 'email', required: true, help: 'Validation preview only. Nothing is sent or saved.' });
  const summary = element('div', { className: 'error-summary mb-3', role: 'alert', hidden: '' });
  const form = element('form', { novalidate: '', className: 'surface-panel', 'aria-labelledby': 'form-preview-heading' }, [
    element('h3', { id: 'form-preview-heading', className: 'h5', text: 'Form validation preview' }),
    summary, email.wrapper,
    element('button', { className: 'btn btn-outline-primary', type: 'submit', text: 'Check example field' }),
  ]);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (validateFields([email], summary)) showToast('The example field is valid. Nothing was submitted.');
  });
  const states = element('div', { className: 'showcase-grid mt-4' }, [
    element('div', {}, [element('h3', { className: 'h5', text: 'Empty-state example' }), createEmptyState({ title: 'No stays to show yet', description: 'Hotel listings will appear when real data is connected.' })]),
    element('div', {}, [element('h3', { className: 'h5', text: 'Loading skeleton example' }), element('p', { className: 'small text-muted', text: 'Illustrative loading state; no request is running.' }), createSkeleton({ label: 'Example loading skeleton; no active request' })]),
  ]);
  return createSection({ eyebrow: 'Design system', title: 'Made for a clearer journey', id: 'design-preview-title', description: 'Reusable interface examples. These controls demonstrate the design system, not live hotel features.' }, [element('div', { className: 'showcase-grid' }, [controls, form]), states]);
}
