import { mountPageShell } from '../components/page.js';
import { initializeSessionNavigation } from './session.js';
import { getVerifiedUser } from '../services/auth.js';
import { getBookingQuote,getBookingGuest,createBooking,reconcileBooking,watchBookingIdentity } from '../services/bookings.js';
import { createBookingAttempt } from '../services/booking-attempt.js';
import { readBookingSelection,validateBookingGuest,bookingPayload,restoreBookingAttempt,pendingSelection,isUuid } from '../utils/booking.js';
import { authPageLink } from '../utils/auth.js';
import { createField,validateFields } from '../components/forms.js';
import { createBookingSummary,euro } from '../components/booking-summary.js';
import { createEmptyState,createSkeleton } from '../components/states.js';
import { confirmAction } from '../components/confirmation-dialog.js';
import { installDiscardGuard } from '../components/discard-guard.js';
import { showToast } from '../components/toast.js';
import { element } from '../utils/dom.js';
import '../styles/booking.css';

mountPageShell(); initializeSessionNavigation();
const content=document.querySelector('#page-content');
function fail(message) {
  content.replaceChildren(createEmptyState({title:'Booking cannot continue',description:message}),
    element('a',{href:'/hotels/',className:'btn btn-outline-primary mt-3',text:'Find a hotel'}));
}
function confirmation(booking) {
  if(!isUuid(booking?.id)) throw new Error('No persisted booking ID.');
  window.location.assign(`/booking-confirmation/?${new URLSearchParams({id:booking.id})}`);
}
async function initialize() {
  content.replaceChildren(createSkeleton({label:'Preparing your booking review'}));
  const user=await getVerifiedUser();
  if(!user) {window.location.replace(authPageLink('login',window.location.pathname+window.location.search)); return;}
  watchBookingIdentity(user.id,()=>window.location.replace(authPageLink('login',window.location.pathname+window.location.search)));
  const storageKey=`staywell.booking-attempt.${user.id}`;
  let saved;
  try {saved=restoreBookingAttempt(sessionStorage.getItem(storageKey));}
  catch {fail('An unfinished request could not be recovered. Check My Bookings before trying again. Recovery storage must be available.'); return;}
  const parsed=readBookingSelection(window.location.search);
  if(!saved && Object.keys(parsed.errors).length) {fail(Object.values(parsed.errors).join(' ')); return;}
  const values=saved?pendingSelection(saved):parsed.values;
  if(saved) {
    try {const booking=await reconcileBooking(user.id,saved.id); if(booking) {sessionStorage.removeItem(storageKey); confirmation(booking); return;}}
    catch { /* Keep the saved request; retry uses the same account and identity. */ }
    showToast('An unfinished booking request was restored. Check its status before starting another reservation.');
  }
  const [initialQuote,profile]=await Promise.all([
    getBookingQuote(values).catch(()=>undefined),getBookingGuest(user.id),
  ]);
  let quote=initialQuote; let busy=false; let dirty=false; let acceptChangedPrice=false;
  let retryNotBefore=0; let retries=0;
  const manager=createBookingAttempt({initial:saved,uuid:()=>crypto.randomUUID(),
    create:(payload,id)=>createBooking(user.id,payload,id),reconcile:id=>reconcileBooking(user.id,id),
    persist:attempt=>sessionStorage.setItem(storageKey,JSON.stringify(attempt)),clear:()=>sessionStorage.removeItem(storageKey)});
  const fields={
    guestName:createField({id:'guestName',label:'Guest name',required:true}),
    phone:createField({id:'phone',label:'Phone (optional)',type:'tel',help:'Leave blank if you do not wish to provide a phone number.'}),
    specialRequests:createField({id:'specialRequests',type:'textarea',label:'Special requests (optional)',help:'Up to 2,000 characters. Requests are not guaranteed.'}),
  };
  fields.specialRequests.input.rows=4; fields.specialRequests.input.maxLength=2000;
  fields.guestName.input.maxLength=200; fields.guestName.input.autocomplete='name';
  fields.phone.input.maxLength=40; fields.phone.input.autocomplete='tel';
  fields.guestName.input.value=saved?.payload.p_guest_name ?? profile?.display_name ?? '';
  fields.phone.input.value=saved?.payload.p_contact_phone ?? profile?.phone ?? '';
  fields.specialRequests.input.value=saved?.payload.p_special_requests ?? '';
  const summary=element('div');
  const status=element('p',{role:'status','aria-live':'polite'});
  const errors=element('p',{className:'error-summary',role:'alert',hidden:''});
  const submit=element('button',{type:'submit',className:'btn btn-primary',text:'Confirm reservation'});
  const refresh=element('button',{type:'button',className:'btn btn-outline-primary',text:'Refresh quote'});
  const form=element('form',{className:'surface-panel booking-form',novalidate:'','aria-label':'Guest booking details'},[
    element('h2',{className:'h4',text:'Guest details'}),errors,...Object.values(fields).map(field=>field.wrapper),
    element('div',{className:'button-row'},[submit,refresh]),status]);
  const guestValues=()=>Object.fromEntries(Object.entries(fields).map(([name,field])=>[name,field.input.value]));
  const available=()=>quote && Number(quote.available_rooms)>0;
  function render() {
    const pending=manager.pending; const p=pending?.payload; const info=pending?.review ?? quote;
    if(info || p) summary.replaceChildren(createBookingSummary({hotelName:info?.hotel_name ?? 'Previous booking selection',roomTypeName:info?.room_type_name ?? 'Previous room type',
      checkIn:values.checkIn,checkOut:values.checkOut,nights:info?.nights ?? 'See dates',guests:values.guests,
      nightlyRate:p?.p_expected_nightly_rate ?? quote.nightly_rate,totalPrice:p?.p_expected_total_price ?? quote.total_price,
      label:pending?'Previously submitted quote — status unresolved':'Current stay quote'}),
      element('p',{className:'small text-muted mt-3',text:`Cancellation uses ${info?.hotel_timezone ?? 'the hotel’s local timezone'}. Availability is checked again when you confirm.`}));
    else summary.replaceChildren(createEmptyState({title:quote===undefined?'Quote could not be loaded':'No eligible room type',description:'Refresh the quote or choose another hotel, date range or guest count.'}));
    const locked=busy || Boolean(pending);
    for(const field of Object.values(fields)) field.input.disabled=locked;
    form.setAttribute('aria-busy',String(busy));
    submit.disabled=busy || Date.now()<retryNotBefore || (!pending && !available());
    submit.textContent=busy?'Checking reservation…':pending?'Check status and retry':'Confirm reservation';
    refresh.disabled=locked;
  }
  async function refreshQuote() {
    if(busy || manager.pending) return;
    busy=true; render(); status.textContent='Fetching a fresh quote…';
    try {
      quote=await getBookingQuote(values);
      status.textContent=available()?'Fresh quote loaded. Review the amount before confirming.':'No room is available for this selection. No reservation was created.';
    } catch {quote=undefined; status.textContent='Quote could not be refreshed. Your guest details have been kept.'; showToast(status.textContent,{tone:'error'});}
    finally {busy=false; render();}
  }
  refresh.addEventListener('click',refreshQuote);
  form.addEventListener('input',()=>{dirty=true; errors.hidden=true;});
  form.addEventListener('submit',async event=>{
    event.preventDefault(); if(busy || Date.now()<retryNotBefore) return;
    if(!manager.pending) {
      if(!validateFields(Object.values(fields),errors)) return;
      const invalid=validateBookingGuest(guestValues());
      for(const [name,field] of Object.entries(fields)) field.setError(invalid[name] ?? '');
      if(Object.keys(invalid).length) {errors.hidden=false; errors.textContent='Please correct the highlighted guest details.'; fields[Object.keys(invalid)[0]].input.focus(); return;}
      if(!available()) return;
      if(acceptChangedPrice) {
        const accepted=await confirmAction({title:'Accept the updated price?',message:`The current stay total is ${euro(quote.total_price)} EUR, at ${euro(quote.nightly_rate)} per night. Accept this quote and reserve?`,confirmLabel:'Accept price and reserve',cancelLabel:'Keep reviewing'});
        if(!accepted) return;
        acceptChangedPrice=false;
      }
    }
    busy=true; errors.hidden=true; render();
    try {
      const result=await manager.submit(manager.pending?.payload ?? bookingPayload(values,quote,guestValues()),
        manager.pending?.review ?? {hotel_name:quote.hotel_name,room_type_name:quote.room_type_name,hotel_timezone:quote.hotel_timezone,nights:quote.nights});
      if(['confirmed','cancelled'].includes(result.outcome)) {dirty=false; confirmation(result.booking); return;}
      if(result.outcome==='re_quote') {
        acceptChangedPrice=true; busy=false; await refreshQuote();
        status.textContent='The price changed. Review the fresh quote; confirmation will ask you to accept the updated amount.';
        showToast(status.textContent); return;
      }
      if(result.outcome==='unavailable') {
        quote=null; status.textContent='This room is no longer available. No reservation was created. Refresh or change your selection.';
      } else if(result.outcome==='retryable_busy') {
        status.textContent='Inventory is busy. Your request is saved. Use Check status and retry; the same request will be reconciled and replayed.';
      } else if(result.outcome==='invalid') {
        status.textContent='The server rejected the booking details. Review the fields and refresh your quote before trying again.';
        quote=undefined;
      } else {
        status.textContent='The outcome is not yet known. Your request is saved. Use Check status and retry before making another reservation.';
      }
      showToast(status.textContent,{tone:result.outcome==='retryable_busy'?'info':'error'});
      if(manager.pending) {
        const delay=Math.min(500*2**Math.min(retries++,3),4000);
        retryNotBefore=Date.now()+delay;
        setTimeout(render,delay+10);
      }
    } catch {
      errors.hidden=false; errors.textContent='The booking could not be submitted or recovered. Keep this page open and try again; your values have been preserved.';
      showToast(errors.textContent,{tone:'error'});
    } finally {busy=false; render();}
  });
  const back=values.hotelId || quote?.hotel_id;
  content.replaceChildren(element('div',{className:'booking-layout'},[summary,form]),
    element('a',{className:'btn btn-outline-primary mt-4',href:back?`/hotel/?${new URLSearchParams({id:back,checkIn:values.checkIn,checkOut:values.checkOut,guests:values.guests})}`:'/hotels/',text:'Change hotel or stay'}),
    element('p',{className:'small text-muted mt-3',text:'An unfinished submitted request is saved in this tab for recovery. Leaving the page does not cancel a reservation.'}));
  installDiscardGuard({shouldConfirm:()=>dirty || manager.busy || Boolean(manager.pending),isBusy:()=>manager.busy,isUncertain:()=>Boolean(manager.pending)});
  render();
  status.textContent=manager.pending?'Resolve your saved request before changing guest details.':available()?'Review your current quote and guest details.':quote===undefined?'Quote could not be loaded. Try Refresh quote.':'This room is not available for these dates and guests.';
}
try {await initialize();} catch {fail('Your session or booking review could not be loaded. Log in again or retry this page.');}
