import {adminPage} from './admin-shell.js';
import {adminRead} from '../services/admin.js';
import {element} from '../utils/dom.js';
import {adminTable} from '../components/admin-table.js';
import {catalogActions} from './admin-actions.js';
await adminPage(async body=>{
  async function load() {
    const hotels=await adminRead('hotels');
    body.replaceChildren(element('a',{href:'/pages/admin/hotel-edit/',className:'btn btn-primary mb-4',text:'Create hotel'}),
      element('p',{text:`${hotels.length} hotels, including inactive properties.`}),
      adminTable(['Name','Destination','Timezone','State','Actions'],hotels.map(record=>[
        record.name,`${record.city}, ${record.country}`,record.timezone,record.is_active?'Published':'Inactive',
        catalogActions({kind:'hotel',table:'hotels',record,editUrl:`/pages/admin/hotel-edit/?id=${record.id}`,viewUrl:`/pages/admin/hotel-view/?id=${record.id}`,reload:load}),
      ])));
  }
  await load();
});
