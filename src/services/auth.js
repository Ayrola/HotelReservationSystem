import { supabaseClient, requireSupabaseClient } from './supabase-client.js';
import { createAuthOperations } from './auth-operations.js';

const operations = () => createAuthOperations(requireSupabaseClient());
export const getVerifiedUser = () => operations().getVerifiedUser();
export const loginGuest = (email,password) => operations().loginGuest(email,password);
export const registerGuest = values => operations().registerGuest(values);
export const logoutGuest = () => operations().logoutGuest();
export function observeVerifiedUser(onChange) {
  if (!supabaseClient) { onChange(null); return () => {}; }
  let generation = 0; let timer;
  const { data } = supabaseClient.auth.onAuthStateChange((event,session) => {
    const ticket = ++generation; clearTimeout(timer);
    if (!session || event === 'SIGNED_OUT') { onChange(null); return; }
    // Auth callbacks run under the SDK lock. Verify outside that callback.
    timer = setTimeout(async () => {
      try {
        const user = await getVerifiedUser();
        if (ticket === generation) onChange(user);
      } catch { if (ticket === generation) onChange(null); }
    },0);
  });
  return () => { ++generation; clearTimeout(timer); data.subscription.unsubscribe(); };
}
