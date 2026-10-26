import {adminPage} from './admin-shell.js';
import {adminRead} from '../services/admin.js';
import {element} from '../utils/dom.js';
import {isUuid} from '../utils/booking.js';
import {adminTable} from '../components/admin-table.js';
import {catalogActions} from './admin-actions.js';
await adminPage(async body=>{
  const id=new URLSearchParams(location.search).get('id');
  if(!isUuid(id)) throw new Error('A valid hotel ID is required.');
  async function load() {
    const [hotel,types]=await Promise.all([adminRead('hotels',{id}),adminRead('room_types',{hotelId:id})]);
    if(!hotel) throw new Error('Hotel not found.');
    body.replaceChildren(element('h2',{text:hotel.name}),element('p',{text:`${hotel.city}, ${hotel.country} · ${hotel.address} · ${hotel.timezone} · ${hotel.is_active?'Published':'Inactive'}`}),
      element('p',{className:'admin-copy',text:hotel.description}),
      catalogActions({kind:'hotel',table:'hotels',record:hotel,editUrl:`/pages/admin/hotel-edit/?id=${id}`,reload:load}),
      element('h3',{className:'mt-5',text:'Room types'}),
      element('div',{className:'button-row mb-4'},[
        element('a',{href:`/pages/admin/room-type-edit/?hotelId=${id}`,className:'btn btn-primary',text:'Create room type'}),
        element('a',{href:`/pages/admin/rooms/?hotelId=${id}`,className:'btn btn-outline-primary',text:'Physical rooms'})]),
      adminTable(['Name','Description','Capacity','Nightly EUR rate','State','Actions'],types.map(record=>[
        record.name,record.description,String(record.capacity),String(record.nightly_rate),record.is_active?'Active':'Inactive',
        catalogActions({kind:'room_type',table:'room_types',record,editUrl:`/pages/admin/room-type-edit/?id=${record.id}&hotelId=${id}`,reload:load}),
      ])));
  }
  await load();
});
