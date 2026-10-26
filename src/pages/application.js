import { initializePage as renderPage } from '../components/page.js';
import { supabaseConfigurationError } from '../services/supabase-client.js';
import { element } from '../utils/dom.js';

// Application composition owns service state; visual components remain data-free.
export function initializePage(parameterNames = []) {
  renderPage(parameterNames);
  if (supabaseConfigurationError) {
    const notice = element('div', { className: 'page-container mt-4', id: 'configuration-notice' }, [
      element('p', { className: 'preview-notice', role: 'status', text: supabaseConfigurationError }),
    ]);
    document.querySelector('main').append(notice);
  }
}
