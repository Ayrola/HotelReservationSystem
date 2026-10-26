import {adminPage} from './admin-shell.js';
import {element} from '../utils/dom.js';
await adminPage(async body=>{
  body.append(element('h2',{text:'Catalog administration'}),element('p',{text:'Manage published hotels, room types and private physical-room inventory. Saved reservations and price snapshots are preserved.'}),
    element('div',{className:'button-row'},[
      element('a',{href:'/pages/admin/hotels/',className:'btn btn-primary',text:'Manage hotels'}),
      element('a',{href:'/pages/admin/hotel-edit/',className:'btn btn-outline-primary',text:'Create hotel'}),
      element('a',{href:'/pages/admin/rooms/',className:'btn btn-outline-primary',text:'Manage physical rooms'})]));
});
