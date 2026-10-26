import { element, icon } from '../utils/dom.js';

export function createEmptyState({ title = 'Nothing here yet', description = 'Please check back later.', iconName = 'calendar2' } = {}) {
  return element('div', { className: 'empty-state' }, [icon(iconName), element('h3', { className: 'h5', text: title }), element('p', { className: 'text-muted mb-0', text: description })]);
}

export function createSkeleton({ label = 'Loading hotel information' } = {}) {
  return element('div', { className: 'skeleton-card', role: 'status', 'aria-busy': 'true' }, [
    element('span', { className: 'visually-hidden', text: label }),
    element('div', { 'aria-hidden': 'true' }, [element('div', { className: 'skeleton skeleton-image' }), element('div', { className: 'skeleton skeleton-line' }), element('div', { className: 'skeleton skeleton-line short' })]),
  ]);
}
