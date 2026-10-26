import { element, icon } from '../utils/dom.js';

export function createFooter() {
  return element('footer', { className: 'site-footer' }, [
    element('div', { className: 'page-container footer-layout' }, [
      element('div', {}, [element('a', { href: '/', className: 'brand', text: 'staywell' }), element('p', { text: 'A little closer to your next escape.', className: 'text-muted mt-2' })]),
      element('nav', { 'aria-label': 'Footer navigation', className: 'footer-links' }, [element('a', { href: '/pages/hotels/', text: 'Explore hotels' }), element('a', { href: '/pages/login/', text: 'Login' }), element('a', { href: '/pages/register/', text: 'Register' })]),
      element('p', { className: 'payment-note' }, [icon('credit-card'), document.createTextNode(' EUR · Pay at the hotel')]),
    ]),
    element('div', { className: 'page-container footer-bottom', text: 'SoftUni capstone · Placeholder platform. Reservations are not available yet.' }),
  ]);
}
