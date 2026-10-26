import { confirmAction } from './confirmation-dialog.js';
import { showToast } from './toast.js';
export function installDiscardGuard({shouldConfirm,isBusy,isUncertain}) {
  let bypass=false;
  document.addEventListener('click',async event=>{
    if(bypass || event.defaultPrevented || event.button!==0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target=event.target.closest('a[href],button[data-logout]');
    if(!target || target.closest('dialog') || (target.tagName==='A' && (target.target==='_blank' || target.getAttribute('href').startsWith('#')))) return;
    if(!shouldConfirm()) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if(isBusy()) {showToast('Wait for the booking request to finish before leaving.'); return;}
    const accepted=await confirmAction({title:'Leave this booking?',message:isUncertain()
      ?'This request may already have created a reservation. Leaving does not cancel it. Its request is saved in this tab for reconciliation when you return.'
      :'Your unsent guest details will be discarded.',confirmLabel:'Leave page',cancelLabel:'Keep reviewing'});
    if(accepted) {bypass=true; target.click();}
  },true);
}
