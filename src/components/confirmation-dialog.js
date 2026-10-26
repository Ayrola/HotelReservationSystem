import { element } from '../utils/dom.js';

let activeDialog = false;

export function confirmAction({ title = 'Please confirm', message, confirmLabel = 'Confirm', cancelLabel = 'Keep editing', destructive = false }) {
  if (activeDialog) return Promise.resolve(false);
  activeDialog = true;
  const opener = document.activeElement;
  return new Promise((resolve) => {
    const cancel = element('button', { type: 'button', className: 'btn btn-outline-primary', text: cancelLabel, autofocus: '' });
    const confirm = element('button', { type: 'button', className: `btn ${destructive ? 'btn-danger' : 'btn-primary'}`, text: confirmLabel });
    const dialog = element('dialog', { className: 'confirmation-dialog', 'aria-labelledby': 'confirmation-title', 'aria-describedby': 'confirmation-description' }, [
      element('p', { className: 'eyebrow', text: 'Confirmation' }),
      element('h2', { id: 'confirmation-title', className: 'h3', text: title }),
      element('p', { id: 'confirmation-description', text: message }),
      element('div', { className: 'dialog-actions' }, [cancel, confirm]),
    ]);
    document.body.append(dialog);
    dialog.addEventListener('keydown', (event) => {
      if (event.key !== 'Tab') return;
      if (event.shiftKey && document.activeElement === cancel) {
        event.preventDefault();
        confirm.focus();
      } else if (!event.shiftKey && document.activeElement === confirm) {
        event.preventDefault();
        cancel.focus();
      }
    });
    let accepted = false;
    cancel.addEventListener('click', () => dialog.close());
    confirm.addEventListener('click', () => { accepted = true; dialog.close(); });
    dialog.addEventListener('close', () => {
      dialog.remove();
      activeDialog = false;
      if (opener?.isConnected) opener.focus();
      resolve(accepted);
    }, { once: true });
    // Native modal dialog supplies focus containment, inert background and Escape.
    dialog.showModal();
    cancel.focus();
  });
}
