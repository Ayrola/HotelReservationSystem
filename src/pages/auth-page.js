import { mountPageShell } from '../components/page.js';
import { createAuthForm } from '../components/auth-form.js';
import { element } from '../utils/dom.js';
import { safeAuthReturn,authPageLink,authErrorMessage } from '../utils/auth.js';
import { getVerifiedUser,loginGuest,registerGuest } from '../services/auth.js';
import { supabaseConfigurationError } from '../services/supabase-client.js';
import { initializeSessionNavigation } from './session.js';
import '../styles/auth.css';

export async function initializeAuthPage(registration = false) {
  mountPageShell(); initializeSessionNavigation();
  const params = new URLSearchParams(window.location.search);
  const next = safeAuthReturn(params.get('next'));
  const content = document.querySelector('#page-content');
  const incoming = new URLSearchParams(window.location.hash.slice(1));
  const callback = incoming.has('access_token') || incoming.has('refresh_token');
  const callbackError = incoming.has('error') || params.has('error');
  const form = createAuthForm({ registration,onSubmit:async (values,view) => {
    try {
      if (registration) {
        const emailRedirectTo = new URL(authPageLink('login',next),window.location.origin).href;
        const result = await registerGuest({ ...values,emailRedirectTo });
        if (!result.authenticated) {
          view.fields.password.input.value = ''; view.fields.confirmPassword.input.value = '';
          view.status.textContent = 'Check your email for a confirmation link. If this address can be registered, confirmation instructions will be sent. Confirm your email, then log in to continue.';
          return;
        }
      } else await loginGuest(values.email,values.password);
      window.location.assign(next);
    } catch (error) { view.showError(authErrorMessage(error)); }
  } });
  content.replaceChildren(form.form,
    element('p', { className:'auth-switch' }, [document.createTextNode(registration?'Already registered? ':'New to Staywell? '),
      element('a', { href:authPageLink(registration?'login':'register',next),text:registration?'Log in':'Create an account' })]));
  if (registration) form.form.prepend(element('p', { className:'text-muted',text:'Create a guest account. Email confirmation may be required before you can log in.' }));
  if (params.get('signedOut')==='1') form.status.textContent = 'You are logged out on this browser.';
  if (callbackError) form.showError('This confirmation link is invalid or has expired. Try logging in if your email has already been confirmed.');
  if (supabaseConfigurationError) {
    form.showError(supabaseConfigurationError);
    form.form.querySelector('button[type=submit]').disabled = true;
    return;
  }
  const submit = form.form.querySelector('button[type=submit]');
  submit.disabled = true;
  form.form.setAttribute('aria-busy','true');
  try {
    const user = await getVerifiedUser();
    // The SDK consumes the implicit confirmation callback before getUser resolves.
    if (window.location.hash) history.replaceState(null,'',window.location.pathname+window.location.search);
    if (user) {
      if (callback && !callbackError) { window.location.replace(next); return; }
      content.replaceChildren(element('div', { className:'surface-panel' }, [
        element('h2', { className:'h4',text:'You are already logged in' }),
        element('p', { text:'Continue to your selected page, or log out from the navigation to use another account.' }),
        element('a', { href:next,className:'btn btn-primary',text:'Continue' })]));
    }
  } catch { /* Keep the form available for a fresh login after a stale session. */ }
  finally {
    if (window.location.hash) history.replaceState(null,'',window.location.pathname+window.location.search);
    submit.disabled = false; form.form.setAttribute('aria-busy','false');
  }
}
