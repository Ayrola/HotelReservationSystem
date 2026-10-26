import { element } from '../utils/dom.js';
import { createField,validateFields } from './forms.js';
import { validateRegistration } from '../utils/auth.js';

export function createAuthForm({ registration,onSubmit }) {
  const fields = {};
  if (registration) fields.displayName = createField({ id:'displayName',label:'Name',required:true });
  fields.email = createField({ id:'email',label:'Email address',type:'email',required:true });
  fields.password = createField({ id:'password',label:'Password',type:'password',required:true,
    help:registration ? 'At least 6 characters. Additional server password requirements may apply.' : '' });
  if (registration) fields.confirmPassword = createField({ id:'confirmPassword',label:'Confirm password',type:'password',required:true });
  fields.email.input.autocomplete = 'email'; fields.email.input.maxLength = 254;
  fields.email.input.autocapitalize = 'none'; fields.email.input.spellcheck = false;
  fields.password.input.autocomplete = registration ? 'new-password' : 'current-password';
  if (registration) {
    fields.displayName.input.autocomplete = 'name'; fields.displayName.input.maxLength = 100;
    fields.password.input.minLength = 6; fields.confirmPassword.input.autocomplete = 'new-password';
  }
  const summary = element('p', { className:'error-summary',role:'alert',hidden:'' });
  const status = element('p', { role:'status','aria-live':'polite' });
  const submit = element('button', { className:'btn btn-primary w-100',type:'submit',text:registration?'Create account':'Log in' });
  const form = element('form', { className:'surface-panel auth-form',novalidate:'','aria-label':registration?'Registration':'Login' },
    [summary,...Object.values(fields).map(field=>field.wrapper),submit,status]);
  const values = () => Object.fromEntries(Object.entries(fields).map(([name,field])=>[name,field.input.value]));
  function setBusy(busy) {
    form.setAttribute('aria-busy',String(busy)); submit.disabled = busy;
    for (const field of Object.values(fields)) field.input.disabled = busy;
    submit.textContent = busy ? 'Please wait…' : registration?'Create account':'Log in';
  }
  function showError(message) { summary.textContent = message; summary.hidden = false; }
  form.addEventListener('submit',async event => {
    event.preventDefault();
    if (submit.disabled || !validateFields(Object.values(fields),summary)) return;
    if (registration) {
      const errors = validateRegistration(values());
      for (const [name,field] of Object.entries(fields)) field.setError(errors[name] ?? '');
      if (Object.keys(errors).length) { showError('Please correct the highlighted fields.'); fields[Object.keys(errors)[0]].input.focus(); return; }
    }
    summary.hidden = true; status.textContent = ''; setBusy(true);
    try { await onSubmit(values(),{ status,showError,fields }); }
    finally { setBusy(false); }
  });
  return { form,fields,status,showError };
}
