// Shared by Vite and the browser. Never include supplied values in error messages.
export function readSupabaseConfiguration(environment) {
  const names = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'];
  const missing = names.filter((name) => !environment[name]?.trim());
  if (missing.length) {
    return { error: `Supabase is not configured. Set ${missing.join(' and ')} in .env.local and restart Vite (or rebuild for production).` };
  }
  const url = environment.VITE_SUPABASE_URL.trim();
  const key = environment.VITE_SUPABASE_PUBLISHABLE_KEY.trim();
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash || !['', '/'].includes(parsed.pathname)) throw new Error();
  } catch {
    return { error: 'VITE_SUPABASE_URL must be the HTTPS project API URL, without credentials, query parameters or additional paths.' };
  }
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) {
    return { error: 'VITE_SUPABASE_PUBLISHABLE_KEY must be a browser-safe Supabase publishable key. Secret keys, legacy JWT keys, service_role keys and database passwords are not accepted.' };
  }
  return { url, key, error: null };
}

// Run before Vite substitutes public environment values into browser assets.
export function assertSafePublicEnvironment(environment) {
  for (const [name, value] of Object.entries(environment)) {
    if (!name.startsWith('VITE_') || !value) continue;
    if (/SECRET|SERVICE_ROLE|PASSWORD|DATABASE_URL|DB_URL/i.test(name) || /sb_secret_|postgres(?:ql)?:\/\//i.test(value)) {
      throw new Error(`Unsafe browser environment variable: ${name}. Remove privileged configuration from VITE_ variables.`);
    }
    if (/^eyJ/.test(value)) {
      throw new Error(`JWT-style key in browser environment variable: ${name}. Use a publishable key for this application.`);
    }
  }
}
