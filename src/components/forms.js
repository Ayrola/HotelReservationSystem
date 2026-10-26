import { element } from '../utils/dom.js';

export function createField({ id, label, type = 'text', help = '', required = false }) {
  const errorId = `${id}-error`;
  const helpId = `${id}-help`;
  const input = element('input', { id, name: id, type, className: 'form-control', 'aria-describedby': `${helpId} ${errorId}` });
  input.required = required;
  const error = element('p', { id: errorId, className: 'field-error', hidden: '' });
  const wrapper = element('div', { className: 'form-field' }, [
    element('label', { for: id, className: 'form-label', text: `${label}${required ? ' (required)' : ''}` }),
    input, element('p', { id: helpId, className: 'form-text', text: help }), error,
  ]);
  function setError(message = '') {
    input.setAttribute('aria-invalid', String(Boolean(message)));
    input.classList.toggle('is-invalid', Boolean(message));
    error.textContent = message;
    error.hidden = !message;
  }
  input.addEventListener('input', () => setError());
  return { wrapper, input, setError };
}

export function validateFields(fields, summary) {
  const invalid = fields.filter(({ input, setError }) => {
    const valid = input.validity.valid;
    setError(valid ? '' : input.validity.valueMissing ? 'Please complete this field.' : 'Please enter a valid value.');
    return !valid;
  });
  summary.hidden = invalid.length === 0;
  summary.textContent = invalid.length ? `Please correct ${invalid.length} field${invalid.length === 1 ? '' : 's'} below.` : '';
  invalid[0]?.input.focus();
  return invalid.length === 0;
}
