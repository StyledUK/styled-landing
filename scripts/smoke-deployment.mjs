// Read-only smoke test for a deployed Styled site.
//
//   node scripts/smoke-deployment.mjs <deployment-url> [--production]
//
// It checks that the real deployment (real Vercel runtime, real environment
// variables, real database) serves the pages and APIs customers, suppliers and
// staff depend on, and that private areas stay locked.
//
// It only sends GET requests and never signs in, so it creates no orders,
// accounts or messages, and is safe to run against styleduk.com at any time.
//
// Protected preview/deployment URLs need VERCEL_AUTOMATION_BYPASS_SECRET
// (Vercel > Project > Settings > Deployment Protection > Protection Bypass for
// Automation). It is sent as a header and never printed.

import { pathToFileURL } from 'node:url';

export const LIVE_SUPABASE_REF = 'yfwqcidkfjzpwbylgnug';
export const DEV_MARKERS = ['qkyeitvwscrxbiwamxan', 'styledukprodprogress'];
const SLOW_MS = 10_000;

// Public pages: path, and text the <title> must contain.
export const PUBLIC_PAGES = [
  ['/', 'Styled'],
  ['/venues', 'venue'],
  ['/suppliers', 'Styled'],
  ['/suppliers/join', 'Become a supplier'],
  ['/business', 'Styled'],
  ['/support', 'Styled'],
  ['/service-info', 'Styled'],
  ['/privacy', 'Privacy'],
  ['/terms', 'terms'],
  ['/login', 'Styled'],
  ['/portal/login', 'Styled for suppliers'],
  ['/admin/login', 'Styled staff'],
];

// Signed-in areas must send anonymous visitors to the right sign-in page.
export const REDIRECTS = [
  ['/admin', '/admin/login'],
  ['/portal', '/portal/login'],
  ['/design', '/login'],
];

// Private APIs must refuse anonymous requests (and must not crash with 500).
export const LOCKED_APIS = [
  '/api/admin/me',
  '/api/admin/orders',
  '/api/admin/suppliers',
  '/api/vendor/me',
  '/api/vendor/orders',
  '/api/cron/sync-ical',
  '/api/cron/booking-notifications',
  '/api/cron/support-notifications',
];

const ERROR_TEXT = /Application error: a (?:client|server)-side exception|Internal Server Error|This page could not be found/;

function titleOf(html) {
  const m = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
  return m ? m[1] : '';
}

export async function runSmoke({ baseUrl, production = false, fetchImpl = fetch, bypassSecret, siteUrl = 'https://styleduk.com' }) {
  const base = String(baseUrl).replace(/\/+$/, '');
  if (!/^https?:\/\//.test(base)) throw new Error(`Deployment URL must start with http(s)://, got "${baseUrl}"`);
  if (bypassSecret && !/^https:\/\/styled-landing-[a-z0-9]+-valorax-ai-s-projects\.vercel\.app$/.test(base)) {
    throw new Error('Automation credentials require an immutable styled-landing deployment URL.');
  }
  const headers = { 'user-agent': 'styled-deployment-smoke/1' };
  if (bypassSecret) headers['x-vercel-protection-bypass'] = bypassSecret;

  const results = [];
  const check = async (name, fn) => {
    const started = Date.now();
    try {
      await fn();
      const ms = Date.now() - started;
      if (ms > SLOW_MS) results.push({ name, ok: false, detail: `took ${ms} ms (limit ${SLOW_MS} ms)` });
      else results.push({ name, ok: true, detail: `${ms} ms` });
    } catch (err) {
      results.push({ name, ok: false, detail: err instanceof Error ? err.message : String(err) });
    }
  };
  const get = (path, opts = {}) => fetchImpl(base + path, { headers, redirect: 'manual', signal: AbortSignal.timeout(SLOW_MS), ...opts });
  const must = (cond, msg) => { if (!cond) throw new Error(msg); };

  await check('GET /api/health returns status ok', async () => {
    const r = await get('/api/health');
    must(r.status === 200, `status ${r.status}`);
    const body = await r.json();
    must(body.status === 'ok', 'health status is not ok');
  });

  for (const [path, title] of PUBLIC_PAGES) {
    await check(`GET ${path} renders`, async () => {
      const r = await get(path);
      must(r.status === 200, `status ${r.status}`);
      const html = await r.text();
      must(titleOf(html).toLowerCase().includes(title.toLowerCase()), `title "${titleOf(html)}" does not contain "${title}"`);
      must(!ERROR_TEXT.test(html), 'page shows an error message');
      for (const marker of DEV_MARKERS) must(!production || !html.includes(marker), `page references development (${marker})`);
    });
  }

  for (const path of ['/portal/login', '/admin/login']) {
    await check(`${path} shows an email and password form`, async () => {
      const html = await (await get(path)).text();
      must(/type="email"/.test(html) && /type="password"/.test(html), 'sign-in form fields missing');
    });
  }

  for (const [path, target] of REDIRECTS) {
    await check(`GET ${path} sends visitors to ${target}`, async () => {
      const r = await get(path);
      must([301, 302, 303, 307, 308].includes(r.status), `status ${r.status}, expected a redirect`);
      const location = new URL(r.headers.get('location') || '', base + '/');
      must(location.pathname === target, `redirects to ${location.pathname}`);
    });
  }

  for (const path of LOCKED_APIS) {
    await check(`GET ${path} refuses anonymous access`, async () => {
      const r = await get(path);
      must([401, 403].includes(r.status), `status ${r.status}, expected 401 or 403`);
    });
  }

  await check('GET /api/catalogue loads products from the database', async () => {
    const r = await get('/api/catalogue');
    must(r.status === 200, `status ${r.status}`);
    const body = await r.json();
    must(body.ok === true && Array.isArray(body.items), 'catalogue response is not { ok: true, items: [] }');
    if (production) must(body.items.length > 0, 'live catalogue is empty');
    for (const item of body.items) {
      must(item && item.id && item.name, 'a catalogue item has no id or name');
      must(item.unitPrice === null || item.unitPrice === undefined || (Number.isFinite(item.unitPrice) && item.unitPrice >= 0),
        `item ${item.id} has an invalid price`);
    }
  });

  await check('GET /api/venues loads', async () => {
    const r = await get('/api/venues');
    must(r.status === 200, `status ${r.status}`);
    const body = await r.json();
    must(Array.isArray(body.venues), 'response has no venues list');
  });

  await check('Unknown pages return 404', async () => {
    const r = await get('/smoke-check-missing-page-' + Date.now());
    must(r.status === 404, `status ${r.status}`);
  });

  await check('robots.txt keeps private areas out of search engines', async () => {
    const r = await get('/robots.txt');
    must(r.status === 200, `status ${r.status}`);
    const text = await r.text();
    for (const path of ['/admin', '/portal', '/api']) must(text.includes(`Disallow: ${path}`), `missing Disallow: ${path}`);
    if (production) must(text.includes(`Sitemap: ${siteUrl}/sitemap.xml`), `sitemap line does not use ${siteUrl}`);
  });

  if (production) {
    await check('sitemap.xml lists only styleduk.com links', async () => {
      const r = await get('/sitemap.xml');
      must(r.status === 200, `status ${r.status}`);
      const locs = [...(await r.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
      must(locs.length > 0, 'sitemap is empty');
      const wrong = locs.filter((l) => !l.startsWith(siteUrl + '/'));
      must(wrong.length === 0, `links outside ${siteUrl}: ${wrong.slice(0, 3).join(', ')}`);
    });
  }

  await check(`Browser code connects to the ${production ? 'live' : 'expected'} database`, async () => {
    const html = await (await get('/login')).text();
    const scripts = [...new Set([...html.matchAll(/src="(\/_next\/static\/[^"?]+\.js(?:\?[^"]*)?)"/g)].map((m) => m[1]))];
    must(scripts.length > 0, 'no script bundles found on /login');
    const refs = new Set();
    for (const src of scripts) {
      const js = await (await get(src)).text();
      for (const m of js.matchAll(/([a-z]{20})\.supabase\.co/g)) refs.add(m[1]);
      for (const marker of DEV_MARKERS) must(!production || !js.includes(marker), `${src} references development (${marker})`);
    }
    must(refs.size > 0, 'no Supabase address found in the browser code');
    if (production) must(refs.size === 1 && refs.has(LIVE_SUPABASE_REF), `browser code uses ${[...refs].join(', ')}`);
  });

  return results;
}

async function main() {
  const args = process.argv.slice(2);
  const production = args.includes('--production');
  const baseUrl = args.find((a) => !a.startsWith('--'));
  if (!baseUrl) {
    console.error('Usage: node scripts/smoke-deployment.mjs <deployment-url> [--production]');
    process.exit(2);
  }
  console.log(`Smoke testing ${baseUrl} (${production ? 'production' : 'preview'} checks)`);
  const results = await runSmoke({ baseUrl, production, bypassSecret: process.env.VERCEL_AUTOMATION_BYPASS_SECRET });
  for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}  (${r.detail})`);
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
  if (failed.length) process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) await main();
