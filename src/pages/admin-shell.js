import { mountPageShell } from '../components/page.js';
import { initializeSessionNavigation } from './session.js';
import { requireAdmin } from '../services/admin.js';
import { authPageLink } from '../utils/auth.js';
import { observeVerifiedUser } from '../services/auth.js';
import { element } from '../utils/dom.js';
import { createEmptyState } from '../components/states.js';
import { showToast } from '../components/toast.js';
import '../styles/admin.css';

export async function adminPage(render) {
  mountPageShell();initializeSessionNavigation();
  const content=document.querySelector('#page-content');
  content.className='page-container section-space';
  content.textContent='Loading administrator access…';
  try {
    const user=await requireAdmin();
    if(!user) {window.location.replace(authPageLink('login',window.location.pathname+window.location.search));return;}
    const nav=element('nav',{className:'button-row mb-4','aria-label':'Catalog administration'},[
      element('a',{href:'/pages/admin/',text:'Overview'}),element('a',{href:'/pages/admin/hotels/',text:'Hotels'}),
      element('a',{href:'/pages/admin/rooms/',text:'Physical rooms'})]);
    const body=element('div');content.replaceChildren(nav,body);
    observeVerifiedUser(async current=>{
      if(!current || current.id!==user.id) {content.hidden=true;return;}
      try {await requireAdmin();} catch {content.hidden=true;showToast('Administrator access is no longer available.',{tone:'error'});}
    });
    await render(body,user);
  } catch(error) {
    content.replaceChildren(createEmptyState({title:'Administration is unavailable',description:error.message || 'Administrator access is required.'}));
    showToast('Administrator access or catalog loading failed.',{tone:'error'});
  }
}
