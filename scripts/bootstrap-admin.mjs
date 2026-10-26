import {createClient} from '@supabase/supabase-js';

class BootstrapError extends Error {}
async function main() {
  const args=process.argv.slice(2);
  const take=name=>args[args.indexOf(name)+1];
  if(args.length!==5 || !args.includes('--project-ref') || !args.includes('--user-id')
    || Number(args.includes('--dry-run'))+Number(args.includes('--execute'))!==1)
    throw new BootstrapError('Use --project-ref <reference> --user-id <existing-auth-uuid> and exactly one of --dry-run or --execute.');
  const ref=take('--project-ref');const id=take('--user-id');
  if(!/^[a-z]{20}$/.test(ref ?? '') || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id ?? ''))
    throw new BootstrapError('An explicit valid project reference and Auth user UUID are required.');
  const key=process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.DEMO_SUPABASE_SECRET_KEY;
  if(!key) throw new BootstrapError('Set a server-only SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY.');
  if(!key.startsWith('sb_secret_')) {
    let payload;try {payload=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString());} catch {}
    if(payload?.role!=='service_role' || payload.ref!==ref) throw new BootstrapError('Use the intended project’s secret key or matching service-role JWT.');
  }
  const url=`https://${ref}.supabase.co`;
  const configured=process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  if(configured && new URL(configured).origin!==url) throw new BootstrapError('Explicit project reference does not match the configured project URL.');
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const existing=await client.auth.admin.getUserById(id);
  if(existing.error || !existing.data.user) throw new BootstrapError('The UUID must identify an existing Auth account. No account was created or reset.');
  const admins=await client.from('user_roles').select('user_id').eq('role','admin');
  if(admins.error) throw new BootstrapError('Admin roles could not be inspected.');
  if(admins.data.some(row=>row.user_id!==id)) throw new BootstrapError('Another admin already exists. First-admin bootstrap refuses to promote an additional user.');
  if(admins.data.some(row=>row.user_id===id)) {console.log('Admin already configured. Promoted: 0; skipped: 1.');return;}
  const role=await client.from('user_roles').select('role').eq('user_id',id).maybeSingle();
  if(role.error || role.data?.role!=='guest') throw new BootstrapError('The existing account must have its trigger-created guest role.');
  if(args.includes('--dry-run')) {console.log('Dry run. Promoted: 0; would promote: 1.');return;}
  const result=await client.from('user_roles').update({role:'admin'}).eq('user_id',id).eq('role','guest').select('user_id').single();
  if(result.error) throw new BootstrapError('Promotion did not return a successful response. Rerun with the same UUID to inspect its role. No passwords or other accounts were changed.');
  console.log('First admin configured. Promoted: 1; skipped: 0.');
}
try {await main();} catch(error) {
  console.error(error instanceof BootstrapError?error.message:'Bootstrap failed; raw service errors and credentials suppressed.');
  process.exitCode=1;
}
