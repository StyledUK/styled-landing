// Tests for the deployment gate: the build-time environment guard and the
// post-deployment smoke test. No network or secrets are used; the smoke test
// runs against a fake in-memory site.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const guard = () => import('../scripts/deploy-env-guard.mjs');
const smoke = () => import('../scripts/smoke-deployment.mjs');

const LIVE = {
  VERCEL_ENV: 'production',
  NEXT_PUBLIC_SUPABASE_URL: 'https://yfwqcidkfjzpwbylgnug.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_fixture',
  SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_fixture',
  NEXT_PUBLIC_SITE_URL: 'https://styleduk.com',
  RESEND_API_KEY: 're_fixture',
  STYLED_PUBLIC_DEMO_ENABLED: 'true',
};

test('guard does nothing outside Vercel, so CI placeholders still build', async () => {
  const { checkDeployEnv } = await guard();
  const r = checkDeployEnv({ NEXT_PUBLIC_SUPABASE_URL: 'https://live-check.invalid' });
  assert.equal(r.skipped, true);
  assert.deepEqual(r.errors, []);
});

test('guard accepts the current live production settings', async () => {
  const { checkDeployEnv } = await guard();
  const r = checkDeployEnv(LIVE);
  assert.deepEqual(r.errors, []);
  assert.equal(checkDeployEnv({ ...LIVE, NEXT_PUBLIC_SITE_URL: 'https://www.styleduk.com/' }).errors.length, 0);
});

test('guard blocks production wired to the development database or site', async () => {
  const { checkDeployEnv } = await guard();
  const dev = checkDeployEnv({ ...LIVE, NEXT_PUBLIC_SUPABASE_URL: 'https://qkyeitvwscrxbiwamxan.supabase.co' });
  assert.ok(dev.errors.some((e) => /development database/.test(e)));
  assert.ok(dev.errors.some((e) => /live Wedding Planner database/.test(e)));
  const site = checkDeployEnv({ ...LIVE, NEXT_PUBLIC_SITE_URL: 'https://styledukprodprogress.vercel.app' });
  assert.ok(site.errors.some((e) => /NEXT_PUBLIC_SITE_URL/.test(e)));
  assert.ok(checkDeployEnv({ ...LIVE, NEXT_PUBLIC_SITE_URL: '' }).errors.some((e) => /not set/.test(e)));
});

test('guard blocks missing, placeholder or swapped database keys', async () => {
  const { checkDeployEnv } = await guard();
  assert.ok(checkDeployEnv({ ...LIVE, SUPABASE_SERVICE_ROLE_KEY: '' }).errors.some((e) => /SUPABASE_SERVICE_ROLE_KEY is not set/.test(e)));
  assert.ok(checkDeployEnv({ ...LIVE, SUPABASE_SERVICE_ROLE_KEY: 'ci-placeholder-server-key' }).errors.some((e) => /placeholder/.test(e)));
  assert.ok(checkDeployEnv({ ...LIVE, SUPABASE_SERVICE_ROLE_KEY: LIVE.NEXT_PUBLIC_SUPABASE_ANON_KEY }).errors.length > 0);
  assert.ok(checkDeployEnv({ ...LIVE, SUPABASE_SERVICE_ROLE_KEY: 'sb_publishable_other' }).errors.some((e) => /publishable/.test(e)));
});

test('guard rejects feature flags that are not exactly true or false', async () => {
  const { checkDeployEnv } = await guard();
  assert.ok(checkDeployEnv({ ...LIVE, ENABLE_BOOKING_EMAILS: 'yes' }).errors.some((e) => /ENABLE_BOOKING_EMAILS/.test(e)));
  assert.deepEqual(checkDeployEnv({ ...LIVE, ENABLE_BOOKING_EMAILS: 'false' }).errors, []);
});

test('guard warns, without blocking, about silent problems', async () => {
  const { checkDeployEnv } = await guard();
  const r = checkDeployEnv({ ...LIVE, RESEND_API_KEY: '' }, { crons: 3 });
  assert.deepEqual(r.errors, []);
  assert.ok(r.warnings.some((w) => /CRON_SECRET/.test(w)));
  assert.ok(r.warnings.some((w) => /email provider/.test(w)));
  const preview = checkDeployEnv({ ...LIVE, VERCEL_ENV: 'preview', NEXT_PUBLIC_SITE_URL: '' });
  assert.ok(preview.errors.some((e) => /Wedding Planner Dev/.test(e)));
  assert.deepEqual(checkDeployEnv({ ...LIVE, VERCEL_ENV: 'preview', NEXT_PUBLIC_SUPABASE_URL: 'https://qkyeitvwscrxbiwamxan.supabase.co' }).errors, []);
});

// A tiny fake of styleduk.com, so the smoke test logic is exercised offline.
function fakeSite(overrides = {}) {
  const page = (title) => `<html><head><title>${title}</title><script src="/_next/static/chunks/app.js?dpl=dpl_1"></script></head><body><input type="email"/><input type="password"/></body></html>`;
  const routes = {
    '/api/health': () => Response.json({ status: 'ok' }),
    '/': () => new Response(page('Styled: see your wedding')),
    '/venues': () => new Response(page('Find your wedding venue · Styled')),
    '/suppliers': () => new Response(page('Suppliers · Styled')),
    '/suppliers/join': () => new Response(page('Become a supplier · Styled')),
    '/business': () => new Response(page('Styled for business')),
    '/support': () => new Response(page('Help · Styled')),
    '/service-info': () => new Response(page('Service · Styled')),
    '/privacy': () => new Response(page('Privacy policy · Styled')),
    '/terms': () => new Response(page('Service terms · Styled')),
    '/login': () => new Response(page('Styled')),
    '/portal/login': () => new Response(page('Styled for suppliers')),
    '/admin/login': () => new Response(page('Styled staff')),
    '/admin': () => new Response(null, { status: 307, headers: { location: '/admin/login?next=%2Fadmin' } }),
    '/portal': () => new Response(null, { status: 307, headers: { location: 'https://styleduk.com/portal/login' } }),
    '/design': () => new Response(null, { status: 307, headers: { location: '/login?mode=login&next=%2Fdesign' } }),
    '/api/catalogue': () => Response.json({ ok: true, items: [{ id: 'p1', name: 'Chair', unitPrice: 450 }, { id: 'p2', name: 'Arch', unitPrice: null }] }),
    '/api/venues': () => Response.json({ venues: [] }),
    '/robots.txt': () => new Response('Disallow: /admin\nDisallow: /portal\nDisallow: /api\nSitemap: https://styleduk.com/sitemap.xml'),
    '/sitemap.xml': () => new Response('<urlset><url><loc>https://styleduk.com/</loc></url></urlset>'),
    '/_next/static/chunks/app.js': () => new Response('createClient("https://yfwqcidkfjzpwbylgnug.supabase.co")'),
    ...overrides,
  };
  return async (url, opts) => {
    const u = new URL(url);
    if (opts?.headers?.['x-vercel-protection-bypass'] !== undefined && opts.headers['x-vercel-protection-bypass'] !== 'fixture-bypass') {
      return new Response('Unauthorized', { status: 401 });
    }
    if (u.pathname.startsWith('/api/admin') || u.pathname.startsWith('/api/vendor') || u.pathname.startsWith('/api/cron')) {
      return (overrides[u.pathname] || (() => Response.json({ ok: false }, { status: 401 })))();
    }
    const handler = routes[u.pathname];
    return handler ? handler() : new Response('Not found', { status: 404 });
  };
}

const failures = (results) => results.filter((r) => !r.ok).map((r) => r.name);

test('smoke test passes a healthy deployment and sends the bypass header', async () => {
  const { runSmoke } = await smoke();
  const results = await runSmoke({ baseUrl: 'https://styled-landing-fixture-valorax-ai-s-projects.vercel.app/', production: true, fetchImpl: fakeSite(), bypassSecret: 'fixture-bypass' });
  assert.deepEqual(failures(results), []);
  assert.ok(results.length >= 30);
});

test('smoke test catches a crashed page, an open admin API and a broken catalogue', async () => {
  const { runSmoke } = await smoke();
  const results = await runSmoke({
    baseUrl: 'https://deploy.test',
    production: true,
    fetchImpl: fakeSite({
      '/venues': () => new Response('<title>Styled</title>Application error: a server-side exception has occurred', { status: 500 }),
      '/api/admin/orders': () => Response.json({ orders: [] }),
      '/api/catalogue': () => Response.json({ ok: false, error: "Couldn't load the catalogue." }, { status: 500 }),
    }),
  });
  const failed = failures(results);
  assert.ok(failed.includes('GET /venues renders'));
  assert.ok(failed.includes('GET /api/admin/orders refuses anonymous access'));
  assert.ok(failed.includes('GET /api/catalogue loads products from the database'));
});

test('smoke test catches a production build wired to the development database', async () => {
  const { runSmoke } = await smoke();
  const results = await runSmoke({
    baseUrl: 'https://deploy.test',
    production: true,
    fetchImpl: fakeSite({ '/_next/static/chunks/app.js': () => new Response('createClient("https://qkyeitvwscrxbiwamxan.supabase.co")') }),
  });
  assert.ok(failures(results).some((n) => /Browser code connects/.test(n)));
});

test('smoke test catches sign-in pages that stop redirecting or a wrong sitemap host', async () => {
  const { runSmoke } = await smoke();
  const results = await runSmoke({
    baseUrl: 'https://deploy.test',
    production: true,
    fetchImpl: fakeSite({
      '/admin': () => new Response('<title>Styled</title>', { status: 200 }),
      '/sitemap.xml': () => new Response('<urlset><url><loc>https://styled-landing-zeta.vercel.app/</loc></url></urlset>'),
    }),
  });
  const failed = failures(results);
  assert.ok(failed.includes('GET /admin sends visitors to /admin/login'));
  assert.ok(failed.includes('sitemap.xml lists only styleduk.com links'));
});

test('smoke test refuses a URL without a scheme', async () => {
  const { runSmoke } = await smoke();
  await assert.rejects(() => runSmoke({ baseUrl: 'styleduk.com', fetchImpl: fakeSite() }), /must start with http/);
});

test('automation credentials are confined to the immutable project hostname', async () => {
  const { runSmoke } = await smoke();
  for (const baseUrl of ['https://styleduk.com', 'https://other.vercel.app', 'https://styled-landing-fixture-valorax-ai-s-projects.vercel.app.example.org']) {
    await assert.rejects(() => runSmoke({ baseUrl, bypassSecret: 'fixture', fetchImpl: fakeSite() }), /immutable/);
  }
});

test('privileged keys are never accepted as browser keys, including legacy JWTs', async () => {
  const { checkDeployEnv } = await guard();
  const claims = Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url');
  for (const key of ['sb_secret_wrong', 'eyJfixture.' + claims + '.fixture']) {
    assert.ok(checkDeployEnv({ ...LIVE, NEXT_PUBLIC_SUPABASE_ANON_KEY: key }).errors.length);
  }
});

test('preview checks accept the development browser configuration and refuse production', async () => {
  const { runSmoke } = await smoke();
  const options = { baseUrl: 'https://preview.test', production: false };
  assert.ok(failures(await runSmoke({ ...options, fetchImpl: fakeSite() })).some(n => n.includes('Browser code connects')));
  assert.deepEqual(failures(await runSmoke({ ...options, fetchImpl: fakeSite({
    '/_next/static/chunks/app.js': () => new Response('https://qkyeitvwscrxbiwamxan.supabase.co'),
  }) })), []);
});
