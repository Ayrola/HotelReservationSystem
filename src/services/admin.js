import { requireSupabaseClient } from './supabase-client.js';
import { getVerifiedUser } from './auth.js';

export async function hasAdminRole(userId) {
  const {data,error}=await requireSupabaseClient().from('user_roles').select('role').eq('user_id',userId).maybeSingle();
  if(error) throw error;
  return data?.role==='admin';
}
export async function requireAdmin() {
  const user=await getVerifiedUser();
  if(!user) return null;
  if(!await hasAdminRole(user.id)) throw new Error('An administrator account is required.');
  return user;
}
function fail(error) {
  if(!error) return;
  const messages={
    '23505':'That room number is already used in this hotel. Choose a unique number.',
    '23503':'This record is referenced. Deactivate it or keep its existing relationships.',
    '23514':'The change violates catalog or reservation integrity. Keep booked relationships and sufficient capacity; check field limits and timezone.',
    '42501':'Administrator permission was denied. Sign in again with an admin account.',
    '55P03':'The record is busy. Wait briefly and try again.',
  };
  throw new Error(messages[error.code] ?? 'The catalog operation failed. Your draft has been preserved.');
}
export async function adminRead(table,{id,hotelId,fields='*'}={}) {
  if(!await requireAdmin()) throw new Error('Please sign in.');
  let query=requireSupabaseClient().from(table).select(fields);
  if(id) query=query.eq('id',id);
  if(hotelId) query=query.eq('hotel_id',hotelId);
  const {data,error}=await query.order(table==='rooms'?'room_number':'name');
  fail(error); return id?data[0] ?? null:data;
}
export async function saveAdminRecord(table,id,values) {
  if(!await requireAdmin()) throw new Error('Please sign in.');
  const client=requireSupabaseClient();
  const query=id?client.from(table).update(values).eq('id',id):client.from(table).insert(values);
  const {data,error}=await query.select('id').single(); fail(error); return data.id;
}
export async function removeAdminRecord(kind,id) {
  if(!await requireAdmin()) throw new Error('Please sign in.');
  const {data,error}=await requireSupabaseClient().rpc('admin_remove_catalog',{p_kind:kind,p_id:id});
  fail(error);return data.outcome;
}
export async function adminTimezones() {
  const {data,error}=await requireSupabaseClient().rpc('admin_timezones'); fail(error);return data;
}
