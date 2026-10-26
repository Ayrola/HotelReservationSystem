import { element, icon } from '../utils/dom.js';

export function mountToastContainer() {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = element('div', { id: 'toast-container', className: 'toast-container', role: 'region', 'aria-label': 'Notifications' });
    document.body.append(container);
  }
  return container;
}

// Persistent until dismissed: messages never disappear before they can be read.
export function showToast(message, { tone = 'info' } = {}) {
  const container = mountToastContainer();
  const content = element('div', { role: tone === 'error' ? 'alert' : 'status', 'aria-atomic': 'true', className: 'toast-message', text: message });
  const close = element('button', { type: 'button', className: 'toast-dismiss', 'aria-label': 'Dismiss notification' }, [icon('x-lg')]);
  const toast = element('div', { className: `app-toast ${tone === 'error' ? 'toast-error' : ''}` }, [content, close]);
  close.addEventListener('click', () => {
    const focused = toast.contains(document.activeElement);
    toast.remove();
    if (focused) document.querySelector('main')?.focus();
  });
  container.append(toast);
  // Update after the live region is mounted so assistive technology can announce it.
  content.textContent = '';
  requestAnimationFrame(() => { content.textContent = message; });
  return () => toast.remove();
}
