// Injectable SDK adapter keeps Auth operations testable without production signups.
export function createAuthOperations(client) {
  async function getVerifiedUser() {
    const { data,error } = await client.auth.getUser();
    if (error?.name === 'AuthSessionMissingError') return null;
    if (error) throw error;
    return data.user;
  }
  async function loginGuest(email,password) {
    const { error } = await client.auth.signInWithPassword({ email:email.trim(),password });
    if (error) throw error;
    const user = await getVerifiedUser();
    if (!user) throw new Error('Session could not be verified.');
    return user;
  }
  async function registerGuest({ email,password,displayName,emailRedirectTo }) {
    const { data,error } = await client.auth.signUp({ email:email.trim(),password,
      options:{ data:{ display_name:displayName.trim() },emailRedirectTo } });
    if (error) throw error;
    return { authenticated:Boolean(data.session) && Boolean(await getVerifiedUser()) };
  }
  async function logoutGuest() {
    const { error } = await client.auth.signOut({ scope:'local' });
    if (error) throw error;
  }
  return { getVerifiedUser,loginGuest,registerGuest,logoutGuest };
}
