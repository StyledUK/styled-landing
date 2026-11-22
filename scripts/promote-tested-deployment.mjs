// Called only by the downstream production job after that event's smoke test succeeds.
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

const project = 'prj_eMZRdYAx6bcYaTmko8GHfr1tubaW';
const domains = ['styleduk.com', 'www.styleduk.com'];

export function verifyCandidate(event, latest, settings) {
  assert.equal(settings.id, project);
  assert.equal(settings.autoAssignCustomDomains, false, 'Enable staged production before promoting.');
  assert.match(event.DEPLOYMENT_ID || '', /^dpl_[A-Za-z0-9]+$/);
  assert.match(event.MAIN_SHA || '', /^[a-f0-9]{40}$/);
  assert.equal(event.DEPLOYMENT_SHA, event.MAIN_SHA, 'Candidate is no longer the tip of main.');
  assert.equal(latest?.uid, event.DEPLOYMENT_ID, 'A newer production build exists.');
  assert.equal(latest.projectId, project);
  assert.equal(latest.target, 'production');
  assert.equal(latest.readyState, 'READY');
  assert.equal(latest.meta?.githubCommitRef, 'main');
  assert.equal(latest.meta?.githubCommitSha, event.MAIN_SHA);
  assert.match(latest.url, /^styled-landing-[a-z0-9]+-valorax-ai-s-projects\.vercel\.app$/);
  assert.equal('https://' + latest.url, event.DEPLOYMENT_URL);
}

export async function release(env, request = fetch, wait = delay) {
  assert.ok(env.VERCEL_PROMOTION_TOKEN, 'Missing dedicated VERCEL_PROMOTION_TOKEN. Deployment stays staged.');
  async function api(path, method = 'GET') {
    const url = new URL(path, 'https://api.vercel.com');
    url.searchParams.set('slug', 'valorax-ai-s-projects');
    const response = await request(url, {method, redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: {authorization: 'Bearer ' + env.VERCEL_PROMOTION_TOKEN}});
    if (!response.ok) throw Error(method + ' ' + url.pathname + ' returned ' + response.status);
    if (method === 'GET') return response.json();
  }
  const assignments = () => Promise.all(domains.map(async domain => (await api('/v13/deployments/' + domain)).id));
  const assigned = ids => ids.every(id => id === env.DEPLOYMENT_ID);
  const [current, settings, builds] = await Promise.all([assignments(), api('/v9/projects/' + project),
    api('/v6/deployments?target=production&limit=1&projectId=' + project)]);
  verifyCandidate(env, builds.deployments[0], settings);
  if (!assigned(current)) {
    await api('/v10/projects/' + project + '/promote/' + env.DEPLOYMENT_ID, 'POST');
    for (let attempt = 0; attempt < 20; attempt++) {
      if (assigned(await assignments())) break;
      await wait(3000);
    }
  }
  assert.ok(assigned(await assignments()), 'Verify both public domains before declaring this release complete.');
  const after = await api('/v9/projects/' + project);
  assert.equal(after.autoAssignCustomDomains, false, 'Staging was disabled. Review production settings immediately.');
  console.log('Both live domains verified on tested deployment ' + env.DEPLOYMENT_ID);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await release(process.env);
