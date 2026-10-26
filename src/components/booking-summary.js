import { element } from '../utils/dom.js';
export const euro=value=>new Intl.NumberFormat('en',{style:'currency',currency:'EUR'}).format(Number(value));
export function createBookingSummary({hotelName,roomTypeName,checkIn,checkOut,nights,guests,nightlyRate,totalPrice,label}) {
  const list=element('dl',{className:'booking-summary'});
  for(const [name,value] of [['Hotel',hotelName],['Room type',roomTypeName],['Check-in',checkIn],['Check-out',checkOut],
    ['Nights',nights],['Guests',guests],['Nightly rate',`${euro(nightlyRate)} EUR`],['Stay total',`${euro(totalPrice)} EUR`]]) {
    list.append(element('dt',{text:name}),element('dd',{text:String(value ?? 'Not available')}));
  }
  return element('section',{className:'surface-panel','aria-label':label},[
    element('h2',{className:'h4',text:label}),list,
    element('p',{text:'One physical room per reservation. Pay at the hotel in EUR. No online payment is collected.'}),
    element('p',{text:'You may cancel only before the check-in date in the hotel’s local timezone. Check-out is exclusive.'}),
  ]);
}
