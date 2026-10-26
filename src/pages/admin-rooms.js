import {adminPage} from './admin-shell.js';
import {adminRead} from '../services/admin.js';
import {element} from '../utils/dom.js';
import {isUuid} from '../utils/booking.js';
import {adminTable} from '../components/admin-table.js';
import {catalogActions} from './admin-actions.js';
await adminPage(async body=>{
  const hotels=await adminRead('hotels');
  const selected=new URLSearchParams(location.search).get('hotelId') || hotels[0]?.id;
  if(!selected) {body.textContent='Create a hotel before adding physical rooms.';return;}
  if(!isUuid(selected) || !hotels.some(hotel=>hotel.id===selected)) throw new Error('Hotel not found.');
  async function load() {
    const [rooms,types]=await Promise.all([adminRead('rooms',{hotelId:selected}),adminRead('room_types',{hotelId:selected})]);
    const selector=element('select',{id:'inventory-hotel',className:'form-select mb-4'},hotels.map(hotel=>element('option',{value:hotel.id,text:hotel.name})));
    selector.value=selected;
    selector.addEventListener('change',()=>location.assign(`/pages/admin/rooms/?hotelId=${selector.value}`));
    body.replaceChildren(element('label',{for:'inventory-hotel',className:'form-label',text:'Hotel'}),selector,
      element('a',{href:`/pages/admin/room-edit/?hotelId=${selected}`,className:'btn btn-primary mb-4',text:'Create physical room'}),
      element('p',{text:'Inventory is private to administrators. Room numbers must be unique within the hotel.'}),
      adminTable(['Room number','Room type','State','Actions'],rooms.map(record=>[
        record.room_number,types.find(type=>type.id===record.room_type_id)?.name ?? 'Unknown type',record.is_active?'Active':'Inactive',
        catalogActions({kind:'room',table:'rooms',record,editUrl:`/pages/admin/room-edit/?id=${record.id}&hotelId=${selected}`,reload:load}),
      ])));
  }
  await load();
});
