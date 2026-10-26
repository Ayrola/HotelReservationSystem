import { defineConfig, loadEnv } from 'vite';
import { pages } from './src/pages/entries.js';
import { assertSafePublicEnvironment, readSupabaseConfiguration } from './src/utils/supabase-config.js';

export default defineConfig(({ mode }) => {
  const environment = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...Object.fromEntries(Object.entries(process.env).filter(([name]) => name.startsWith('VITE_'))) };
  assertSafePublicEnvironment(environment);
  const configuration = readSupabaseConfiguration(environment);
  if (configuration.error && (environment.VITE_SUPABASE_URL || environment.VITE_SUPABASE_PUBLISHABLE_KEY)) {
    throw new Error(configuration.error);
  }
  return {
    appType: 'mpa',
    input: Object.fromEntries(pages.map(({ key, html }) => [key, html])),
  };
});
