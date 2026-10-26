import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import '../styles/main.css';
import { readSelection } from '../utils/query-params.js';
import { element } from '../utils/dom.js';
import { createHeader } from './header.js';
import { createFooter } from './footer.js';
import { mountToastContainer } from './toast.js';
import { createEmptyState } from './states.js';
import { createHero, createFeatureStrip, createHotelCollection, createDesignPreview } from './design-preview.js';

export function initializePage(parameterNames = []) {
 document.querySelector('#site-header').replaceChildren(createHeader());
 document.querySelector('#site-footer').replaceChildren(createFooter());
 mountToastContainer();
 const content = document.querySelector('#page-content');
 const home = window.location.pathname === '/';
 const hotels = window.location.pathname === '/pages/hotels/';
 if (home) {
  const heading = document.querySelector('h1');
  const hero = createHero(heading);
  document.querySelector('.page-heading').replaceWith(hero);
 }
 const container = element('div', { className: 'page-container' });
 if (home || hotels) {
  container.append(createFeatureStrip(), createHotelCollection());
  if (home) container.append(createDesignPreview());
 } else {
  container.classList.add('section-space');
  container.append(createEmptyState({ title: 'This page is being prepared', description: 'This is a placeholder. Real hotel, account and booking features will be added in later milestones.' }));
 }
 content.replaceChildren(container);
 if (parameterNames.length === 0) return;
 const selection = readSelection(parameterNames);
 const target = document.querySelector('#selection-context');
 const list = element('dl');
 for (const [name, value] of Object.entries(selection)) {
  list.append(element('dt', { text: name }), element('dd', { text: value || 'Not selected' }));
 }
 target.append(element('h2', { className: 'h5', text: 'Selected record (placeholder)' }), list);
}
