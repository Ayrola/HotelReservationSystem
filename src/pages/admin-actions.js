import {element} from '../utils/dom.js';
import {confirmAction} from '../components/confirmation-dialog.js';
import {showToast} from '../components/toast.js';
import {removeAdminRecord,saveAdminRecord} from '../services/admin.js';

export function catalogActions({kind,table,record,editUrl,viewUrl,reload}) {
  const actions=element('div',{className:'admin-table-actions'});
  if(viewUrl) actions.append(element('a',{href:viewUrl,className:'btn btn-outline-primary',text:'View'}));
  actions.append(element('a',{href:editUrl,className:'btn btn-outline-primary',text:'Edit'}));
  for(const remove of [false,true]) {
    const button=element('button',{type:'button',className:`btn ${remove?'btn-danger':'btn-outline-primary'}`,text:remove?'Delete / deactivate':record.is_active?'Deactivate':'Activate'});
    button.addEventListener('click',async()=>{
      const accepted=await confirmAction({title:remove?'Delete or deactivate this record?':record.is_active?'Deactivate this record?':'Activate this record?',
        message:remove?'Only unreferenced records are deleted. Records with booking history or dependent catalog records are deactivated; history is preserved.':'This changes eligibility for future searches and bookings. Existing reservations remain saved.',
        confirmLabel:remove?'Delete / deactivate':'Apply change',destructive:remove});
      if(!accepted) return;
      button.disabled=true;
      try {
        if(remove) {const outcome=await removeAdminRecord(kind,record.id);showToast(`Record ${outcome}.`);}
        else {await saveAdminRecord(table,record.id,{is_active:!record.is_active});showToast('Active state updated.');}
        await reload();
      } catch(error) {showToast(error.message,{tone:'error'});button.disabled=false;}
    });
    actions.append(button);
  }
  return actions;
}
