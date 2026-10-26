import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readSupabaseConfiguration, assertSafePublicEnvironment } from '../src/utils/supabase-config.js';
import { createServer } from 'vite';

const valid = { VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example_test_only' };

test('reports both missing settings without supplying fallback credentials', () => {
  const result = readSupabaseConfiguration({});
  assert.match(result.error, /VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY/);
  assert.equal(result.key, undefined);
});

test('accepts only an HTTPS API origin and publishable key', () => {
  assert.equal(readSupabaseConfiguration(valid).error, null);
  for (const url of ['http://example.supabase.co', 'https://user:password@example.supabase.co', 'https://example.supabase.co/rest/v1', 'not-a-url']) {
    assert.match(readSupabaseConfiguration({ ...valid, VITE_SUPABASE_URL: url }).error, /HTTPS project API URL/);
  }
  for (const key of ['sb_secret_test_only', 'eyJtest.jwt.signature', 'database-password']) {
    const error = readSupabaseConfiguration({ ...valid, VITE_SUPABASE_PUBLISHABLE_KEY: key }).error;
    assert.match(error, /browser-safe/);
    assert.ok(!error.includes(key));
  }
});

test('prevents known privileged VITE settings before browser substitution', () => {
  assert.doesNotThrow(() => assertSafePublicEnvironment(valid));
  for (const environment of [
    { VITE_SUPABASE_KEY: 'sb_secret_test_only' },
    { VITE_SERVICE_ROLE_KEY: 'anything' },
    { VITE_DATABASE_PASSWORD: 'anything' },
    { VITE_CONNECTION: 'postgresql://user:password@example/db' },
    { VITE_OTHER_KEY: 'eyJtest.jwt.signature' },
  ]) assert.throws(() => assertSafePublicEnvironment(environment), /browser environment variable/);
});

test('the real SDK service exports one cached instance when configured', async () => {
  const server = await createServer({
    configFile: false,
    envFile: false,
    logLevel: 'silent',
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(valid.VITE_SUPABASE_URL),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(valid.VITE_SUPABASE_PUBLISHABLE_KEY),
    },
  });
  try {
    const first = await server.ssrLoadModule('/src/services/supabase-client.js');
    const second = await server.ssrLoadModule('/src/services/supabase-client.js');
    assert.equal(first.supabaseConfigurationError, null);
    assert.ok(first.supabaseClient);
    assert.equal(first.supabaseClient, second.supabaseClient);
    assert.equal(first.requireSupabaseClient(), first.supabaseClient);
  } finally {
    await server.close();
  }
});
