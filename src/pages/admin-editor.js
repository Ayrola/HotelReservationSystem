import {adminPage} from './admin-shell.js';
import {adminRead,adminTimezones,saveAdminRecord} from '../services/admin.js';
import {element} from '../utils/dom.js';
import {isUuid} from '../utils/booking.js';
import {createField,validateFields} from '../components/forms.js';
import {showToast} from '../components/toast.js';
import {confirmAction} from '../components/confirmation-dialog.js';

const definitions={
  hotel:[['name','Hotel name','text',200,true],['description','Description','textarea',10000,false],['city','City','text',100,true],['country','Country','text',100,true],['address','Address','text',500,true],['timezone','IANA timezone','text',100,true]],
  room_type:[['name','Room-type name','text',200,true],['description','Description','textarea',10000,false],['capacity','Capacity','number',null,true],['nightly_rate','Nightly rate (EUR)','number',null,true]],
  room:[['room_number','Room number','text',40,true]],
};
export async function adminEditor(kind) {
  await adminPage(async body=>{
    const table={hotel:'hotels',room_type:'room_types',room:'rooms'}[kind];
    const params=new URLSearchParams(location.search);let id=params.get('id');
    if(id && !isUuid(id)) throw new Error('Invalid record ID.');
    const record=id?await adminRead(table,{id}):null;
    if(id && !record) throw new Error('Record not found.');
    const hotelId=kind==='hotel'?null:record?.hotel_id ?? params.get('hotelId');
    if(kind!=='hotel' && !isUuid(hotelId)) throw new Error('A valid hotel ID is required.');
    const [zones,types,hotel]=await Promise.all([
      kind==='hotel'?adminTimezones():[],kind==='room'?adminRead('room_types',{hotelId}):[],
      kind!=='hotel'?adminRead('hotels',{id:hotelId}):null,
    ]);
    if(kind!=='hotel' && !hotel) throw new Error('Hotel not found.');
    const fields=Object.fromEntries(definitions[kind].map(([name,label,type,max,required])=>{
      const field=createField({id:name,label,type,required});
      if(max) field.input.maxLength=max;
      field.input.value=record?.[name] ?? (name==='timezone'?'Europe/Sofia':name==='country'?'Bulgaria':'');
      if(type==='number') {field.input.min=name==='capacity'?'1':'0';field.input.step=name==='capacity'?'1':'0.01';}
      return [name,field];
    }));
    let roomType;
    if(kind==='room') {
      roomType=element('select',{id:'room_type_id',className:'form-select',required:''},[
        element('option',{value:'',text:'Choose a room type'}),...types.map(type=>element('option',{value:type.id,text:`${type.name}${type.is_active?'':' (inactive)'}`}))]);
      roomType.value=record?.room_type_id ?? '';
    }
    const active=element('input',{id:'is_active',type:'checkbox',className:'form-check-input'});active.checked=record?.is_active ?? false;
    const errors=element('p',{className:'error-summary',role:'alert',hidden:''});
    const save=element('button',{type:'submit',className:'btn btn-primary',text:'Save changes'});
    const back=element('a',{className:'btn btn-outline-primary',href:kind==='hotel'?'/pages/admin/hotels/':kind==='room'?`/pages/admin/rooms/?hotelId=${hotelId}`:`/pages/admin/hotel-view/?id=${hotelId}`,text:'Back to catalog'});
    const form=element('form',{className:'surface-panel admin-form',novalidate:'','aria-label':`Edit ${kind.replace('_',' ')}`},[
      element('h2',{className:'h4',text:`${id?'Edit':'Create'} ${kind.replace('_',' ')}${hotel?` · ${hotel.name}`:''}`}),errors,
      ...Object.values(fields).map(field=>field.wrapper),
      ...(roomType?[element('div',{className:'form-field'},[element('label',{for:'room_type_id',className:'form-label',text:'Room type (required)'}),roomType,element('p',{className:'form-text',text:'Rooms with booking history cannot change room type.'})])]:[]),
      element('div',{className:'form-check mb-4'},[active,element('label',{for:'is_active',className:'form-check-label',text:kind==='hotel'?'Published / active':'Active'})]),
      element('div',{className:'button-row'},[save,back]),
    ]);
    if(kind==='hotel') {
      const list=element('datalist',{id:'hotel-timezones'},zones.map(value=>element('option',{value})));
      fields.timezone.input.setAttribute('list','hotel-timezones');form.append(list);
    }
    let dirty=false;let busy=false;let bypass=false;
    form.addEventListener('input',()=>{dirty=true;errors.hidden=true;});
    document.addEventListener('click',async event=>{
      if(bypass || !dirty || event.button!==0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const target=event.target.closest('a[href],button[data-logout]');
      if(!target || target.closest('dialog') || target.target==='_blank') return;
      event.preventDefault();event.stopImmediatePropagation();
      if(busy) {showToast('Wait for the save to finish.');return;}
      if(await confirmAction({title:'Discard unsaved changes?',message:'Your catalog draft will be discarded.',confirmLabel:'Discard draft',cancelLabel:'Keep editing',destructive:true})) {bypass=true;target.click();}
    },true);
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(busy || !validateFields(Object.values(fields),errors)) return;
      const values=Object.fromEntries(Object.entries(fields).map(([name,field])=>[name,field.input.value.trim()]));
      let invalid={};
      for(const [name,,type,max,required] of definitions[kind]) {
        if(required && !values[name]) invalid[name]='This field is required.';
        if(max && values[name].length>max) invalid[name]=`Use at most ${max} characters.`;
      }
      if(kind==='hotel' && !zones.includes(values.timezone)) invalid.timezone='Choose a supported IANA timezone from the list.';
      if(kind==='room_type') {
        if(!/^[1-9]\d*$/.test(values.capacity) || Number(values.capacity)>2147483647) invalid.capacity='Enter a positive whole capacity.';
        if(!/^\d+(\.\d{1,2})?$/.test(values.nightly_rate) || Number(values.nightly_rate)>9999999999.99) invalid.nightly_rate='Enter a nonnegative EUR amount with at most two decimals.';
      }
      for(const [name,field] of Object.entries(fields)) field.setError(invalid[name] ?? '');
      if(roomType) roomType.setAttribute('aria-invalid',String(!types.some(type=>type.id===roomType.value)));
      if(Object.keys(invalid).length || (roomType && !types.some(type=>type.id===roomType.value))) {
        errors.hidden=false;errors.textContent='Correct the highlighted fields and select a valid room type.';
        (fields[Object.keys(invalid)[0]]?.input ?? roomType).focus();return;
      }
      values.is_active=active.checked;
      if(kind==='room_type') {values.capacity=Number(values.capacity);values.currency='EUR';values.hotel_id=hotelId;}
      if(kind==='room') {values.room_type_id=roomType.value;values.hotel_id=hotelId;}
      busy=true;save.disabled=true;form.setAttribute('aria-busy','true');
      const controls=[...Object.values(fields).map(field=>field.input),active,...(roomType?[roomType]:[])];
      controls.forEach(control=>{control.disabled=true;});
      try {
        id=await saveAdminRecord(table,id,values);dirty=false;
        const url=new URL(location.href);url.searchParams.set('id',id);history.replaceState(null,'',url);
        form.querySelector('h2').textContent=`Edit ${kind.replace('_',' ')}${hotel?` · ${hotel.name}`:''}`;
        showToast('Catalog changes saved.');
        if(kind==='hotel') {
          let view=form.querySelector('[data-view-hotel]');
          if(!view) {view=element('a',{'data-view-hotel':'',className:'btn btn-outline-primary',text:'View hotel'});form.querySelector('.button-row').append(view);}
          view.href=`/pages/admin/hotel-view/?id=${id}`;
        }
      } catch(error) {errors.hidden=false;errors.textContent=error.message;showToast(error.message,{tone:'error'});}
      finally {busy=false;save.disabled=false;controls.forEach(control=>{control.disabled=false;});form.setAttribute('aria-busy','false');}
    });
    body.replaceChildren(form);
  });
}
