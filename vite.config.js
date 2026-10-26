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
      name: 'public-hotel-route-aliases',
      enforce: 'post',
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          if (/^\/hotels(?:\/|\?|$)/.test(request.url)) request.url = request.url.replace(/^\/hotels\/?/, '/pages/hotels/');
          if (/^\/hotel(?:\/|\?|$)/.test(request.url)) request.url = request.url.replace(/^\/hotel\/?/, '/pages/hotel/');
          if (/^\/booking(?:\/|\?|$)/.test(request.url)) request.url = request.url.replace(/^\/booking\/?/, '/pages/booking/');
          if (/^\/booking-confirmation(?:\/|\?|$)/.test(request.url)) request.url = request.url.replace(/^\/booking-confirmation\/?/, '/pages/booking-confirmation/');
          next();
        });
      },
      generateBundle(options, bundle) {
        const hotels = bundle['pages/hotels/index.html'];
        if (hotels) this.emitFile({ type: 'asset', fileName: 'hotels/index.html', source: hotels.source });
        const hotel = bundle['pages/hotel/index.html'];
        if (hotel) this.emitFile({ type: 'asset', fileName: 'hotel/index.html', source: hotel.source });
        for(const name of ['booking','booking-confirmation']) {
          const entry=bundle[`pages/${name}/index.html`];
          if(entry) this.emitFile({type:'asset',fileName:`${name}/index.html`,source:entry.source});
        }
      },
    }],
    appType: 'mpa',
    input: Object.fromEntries(pages.map(({ key, html }) => [key, html])),
  };
});
