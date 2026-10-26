import { createHeader } from '../components/header.js';
import { showToast } from '../components/toast.js';
import { observeVerifiedUser, logoutGuest } from '../services/auth.js';

let started = false;
export function initializeSessionNavigation() {
  if (started) return;
  started = true;
  let lastAuthenticated;
  observeVerifiedUser(user => {
    const authenticated = Boolean(user);
    if (lastAuthenticated === authenticated) return;
    lastAuthenticated = authenticated;
    document.querySelector('#site-header').replaceChildren(createHeader({ authenticated,onLogout:async event => {
      const button = event.currentTarget; button.disabled = true;
      try {
        await logoutGuest();
        window.location.assign('/pages/login/?signedOut=1');
      } catch {
        showToast('Logout could not be completed. Please try again.',{ tone:'error' });
        button.disabled = false;
      }
    } }));
  });
}
