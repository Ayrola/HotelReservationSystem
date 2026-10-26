import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { preview } from 'vite';
import { pages } from '../src/pages/entries.js';
import { readSelection } from '../src/utils/query-params.js';

const server = await preview({ preview: { host: '127.0.0.1', port: 0, open: false } });
try {
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  const assets = new Set();
  for (const page of pages) {
    const built = await readFile(new URL(`../dist/${page.html}`, import.meta.url), 'utf8');
    const response = await fetch(`${origin}${page.path}`);
    assert.equal(response.status, 200, page.path);
    assert.match(response.headers.get('content-type'), /text\/html/);
    const served = await response.text();
    assert.equal(served, built, `Wrong nested entry: ${page.path}`);
    assert.ok(new RegExp(`<h1[^>]*>${page.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</h1>`).test(served));
    assert.match(served, /<script\b[^>]*type="module"[^>]*src="\/assets\//);
    for (const [, path] of served.matchAll(/(?:src|href)="([^"#]+)"/g)) {
      if (path.startsWith('/assets/') || path.startsWith('/images/')) {
        if (assets.has(path)) continue;
        const asset = await fetch(`${origin}${path}`);
        assert.equal(asset.status, 200, path);
        assert.doesNotMatch(asset.headers.get('content-type') || '', /text\/html/);
        assets.add(path);
      } else if (path.startsWith('/')) {
        assert.ok(path === '/hotels/' || pages.some((entry) => entry.path === path), `Unknown navigation link: ${path}`);
      }
    }
    console.log(`PASS ${page.path} -> dist/${page.html}`);
  }
  for (const path of [
    '/hotels/?destination=Sofia&checkIn=2030-01-01&checkOut=2030-01-03&guests=2',
    '/pages/hotel/?id=example-hotel',
    '/pages/booking/?roomTypeId=example-type&checkIn=2026-11-01&checkOut=2026-11-03&guests=2',
    '/pages/booking-details/?id=example-reservation',
  ]) {
    const response = await fetch(`${origin}${path}`);
    assert.equal(response.status, 200, path);
    const pathname = new URL(path, origin).pathname;
    const page = pages.find((entry) => entry.path === (pathname === '/hotels/' ? '/pages/hotels/' : pathname));
    assert.ok((await response.text()).includes(`<h1>${page.title}</h1>`));
    console.log(`PASS ${path}`);
  }
  assert.deepEqual(readSelection(['id'], '?id=%3Cscript%3E'), { id: '<script>' });
  assert.deepEqual(readSelection(['id'], ''), { id: null });
  assert.equal((await fetch(`${origin}/not-a-page/`)).status, 404, 'No SPA fallback');
  console.log(`Verified ${pages.length} pages, ${assets.size} linked assets, query URLs, parameter parsing and missing-page 404.`);
} finally {
  await new Promise((resolve, reject) => server.httpServer.close((error) => error ? reject(error) : resolve()));
}
