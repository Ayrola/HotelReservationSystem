import { element, icon } from '../utils/dom.js';

// Authentication is injected from verified application service state.
export function createHeader({ authenticated = false, isAdmin = false, onLogout } = {}) {
  const brand = element('a', { href: '/', className: 'brand', 'aria-label': 'Staywell home' }, [icon('buildings'), element('span', { text: 'staywell' })]);
  const links = element('ul', { id: 'primary-navigation', className: 'primary-navigation' });
  const items = [['Home', '/'], ['Hotels', '/pages/hotels/']];
  items.push(...(authenticated ? [['My Bookings', '/pages/my-bookings/'], ['Account', '/pages/account/']] : [['Login', '/pages/login/'], ['Register', '/pages/register/']]));
  if(authenticated && isAdmin) items.push(['Admin','/pages/admin/']);
  for (const [text, href] of items) {
    const link = element('a', { href, text, className: text === 'Register' ? 'btn btn-primary' : 'navigation-link' });
    if (window.location.pathname === href) link.setAttribute('aria-current', 'page');
    links.append(element('li', {}, [link]));
  }
  if (authenticated) {
    const logout = element('button', { type: 'button', className: 'btn btn-outline-primary', text: 'Logout', 'data-logout':'' });
    logout.disabled = typeof onLogout !== 'function';
    if (onLogout) logout.addEventListener('click', onLogout);
    links.append(element('li', {}, [logout]));
  }
  const toggle = element('button', { type: 'button', className: 'menu-toggle btn btn-outline-primary', 'aria-controls': links.id, 'aria-expanded': 'false', 'aria-label': 'Open navigation' }, [icon('list')]);
  function close() {
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open navigation');
    links.classList.remove('is-open');
  }
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    links.classList.toggle('is-open', open);
  });
  const nav = element('nav', { className: 'page-container header-layout', 'aria-label': 'Main navigation' }, [brand, toggle, links]);
  nav.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      close();
      toggle.focus();
    }
  });
  nav.addEventListener('focusout', (event) => {
    if (!nav.contains(event.relatedTarget)) close();
  });
  return element('header', { className: 'site-header' }, [nav]);
}
