// Text and attributes are assigned through DOM APIs, never interpolated as HTML.
export function element(tag, { className, text, ...attributes } = {}, children = []) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  for (const [name, value] of Object.entries(attributes)) {
    if (value !== undefined && value !== null) node.setAttribute(name, value);
  }
  node.append(...children);
  return node;
}

export const icon = (name) => element('i', { className: `bi bi-${name}`, 'aria-hidden': 'true' });

export function safeImageUrl(value) {
  const url = new URL(value, window.location.origin);
  return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
}
