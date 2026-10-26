import { createHeader } from '../components/header.js';
import { showToast } from '../components/toast.js';
import { observeVerifiedUser, logoutGuest } from '../services/auth.js';
import { hasAdminRole } from '../services/admin.js';

let started = false;
export function initializeSessionNavigation() {
  if (started) return;
  started = true;
  let lastState; let generation=0;
  observeVerifiedUser(async user => {
    const ticket=++generation;
    const authenticated = Boolean(user);
    let isAdmin=false;
    if(user) {try {isAdmin=await hasAdminRole(user.id);} catch { /* Fail closed. */ }}
    if(ticket!==generation) return;
    const state=`${user?.id ?? ''}:${isAdmin}`;
    if(lastState===state) return;
    lastState=state;
    document.querySelector('#site-header').replaceChildren(createHeader({ authenticated,isAdmin,onLogout:async event => {
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
