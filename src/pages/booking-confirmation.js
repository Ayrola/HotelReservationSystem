import { mountPageShell } from '../components/page.js';
import { initializeSessionNavigation } from './session.js';
import { getVerifiedUser } from '../services/auth.js';
import { loadSavedBooking,watchBookingIdentity } from '../services/bookings.js';
import { authPageLink } from '../utils/auth.js';
import { isUuid } from '../utils/booking.js';
import { calendarDay } from '../utils/hotel-search.js';
import { createBookingSummary } from '../components/booking-summary.js';
import { createEmptyState,createSkeleton } from '../components/states.js';
import { showToast } from '../components/toast.js';
import { element } from '../utils/dom.js';
import '../styles/booking.css';

mountPageShell(); initializeSessionNavigation();
const content=document.querySelector('#page-content');
let stopIdentityWatch;
async function load() {
  content.replaceChildren(createSkeleton({label:'Loading your persisted reservation'}));
  try {
    const user=await getVerifiedUser();
    if(!user) {window.location.replace(authPageLink('login',window.location.pathname+window.location.search)); return;}
    stopIdentityWatch?.();
    stopIdentityWatch=watchBookingIdentity(user.id,()=>window.location.replace(authPageLink('login',window.location.pathname+window.location.search)));
    const params=new URLSearchParams(window.location.search); const id=params.get('id');
    const booking=isUuid(id) && params.getAll('id').length===1 ? await loadSavedBooking(user.id,id) : null;
    if(!booking) {
      document.querySelector('h1').textContent='Booking not available';
      content.replaceChildren(createEmptyState({title:'No accessible reservation was found',description:'The link may be incomplete, or this reservation may belong to another account.'}),
        element('a',{href:'/pages/my-bookings/',className:'btn btn-outline-primary mt-3',text:'My Bookings'})); return;
    }
    const confirmed=booking.status==='confirmed';
    document.querySelector('h1').textContent=confirmed?'Your booking is confirmed':'This reservation is cancelled';
    content.replaceChildren(element('p',{className:'preview-notice',text:`Reference: ${booking.reference} · Status: ${booking.status}`}),
      createBookingSummary({hotelName:booking.hotel_name_snapshot,roomTypeName:booking.room_type_name_snapshot,
        checkIn:booking.check_in,checkOut:booking.check_out,nights:calendarDay(booking.check_out)-calendarDay(booking.check_in),guests:booking.guest_count,
        nightlyRate:booking.nightly_rate_snapshot,totalPrice:booking.total_price,label:'Saved reservation price'}),
      element('div',{className:'button-row mt-4'},[
        element('a',{href:`/pages/booking-details/?${new URLSearchParams({id:booking.id})}`,className:'btn btn-primary',text:'Booking Details'}),
        element('a',{href:'/pages/my-bookings/',className:'btn btn-outline-primary',text:'My Bookings'})]));
    showToast(confirmed?'Your saved reservation is confirmed. Pay at the hotel.':'This saved reservation is cancelled. No replacement has been created.');
  } catch {
    const retry=element('button',{type:'button',className:'btn btn-outline-primary mt-3',text:'Try loading this booking again'});
    retry.addEventListener('click',load);
    content.replaceChildren(createEmptyState({title:'Booking could not be loaded',description:'Please try again. A loading error does not mean a submitted booking failed.'}),retry);
    showToast('Your persisted booking could not be loaded.',{tone:'error'});
  }
}
await load();
