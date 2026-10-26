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
    plugins: [{
      name: 'hotels-route-alias',
      enforce: 'post',
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          if (/^\/hotels(?:\/|\?|$)/.test(request.url)) request.url = request.url.replace(/^\/hotels\/?/, '/pages/hotels/');
          next();
        });
      },
      generateBundle(options, bundle) {
        const hotels = bundle['pages/hotels/index.html'];
        if (hotels) this.emitFile({ type: 'asset', fileName: 'hotels/index.html', source: hotels.source });
      },
    }],
    appType: 'mpa',
    input: Object.fromEntries(pages.map(({ key, html }) => [key, html])),
  };
});
