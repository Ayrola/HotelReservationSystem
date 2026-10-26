import { element } from '../utils/dom.js';

export function createSection({ eyebrow, title, description, id, className = '' }, children = []) {
  return element('section', { className: `section-space ${className}`, 'aria-labelledby': id }, [
    ...(eyebrow ? [element('p', { className: 'eyebrow', text: eyebrow })] : []),
    element('h2', { id, text: title }),
    ...(description ? [element('p', { className: 'section-description', text: description })] : []),
    ...children,
  ]);
}
