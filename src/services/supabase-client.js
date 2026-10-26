import { createClient } from '@supabase/supabase-js';
import { readSupabaseConfiguration } from '../utils/supabase-config.js';

const configuration = readSupabaseConfiguration({
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
});

export const supabaseConfigurationError = configuration.error;

// ES modules are evaluated once per page: all services share this single client.
// Missing configuration leaves placeholders usable and never sends a request.
export const supabaseClient = configuration.error
  ? null
  : createClient(configuration.url, configuration.key);

export function requireSupabaseClient() {
  if (!supabaseClient) throw new Error(supabaseConfigurationError);
  return supabaseClient;
}
