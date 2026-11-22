const {test} = require('node:test');
const assert = require('node:assert/strict');

test('a previous green build of the same commit cannot promote a different deployment', async () => {
  const {verifyCandidate} = await import('../scripts/promote-tested-deployment.mjs');
  const sha = 'b'.repeat(40);
  const project = 'prj_eMZRdYAx6bcYaTmko8GHfr1tubaW';
  const url = 'styled-landing-abc123-valorax-ai-s-projects.vercel.app';
  const settings = {id:project, autoAssignCustomDomains:false};
  const event = {DEPLOYMENT_ID:'dpl_abc', MAIN_SHA:sha, DEPLOYMENT_SHA:sha, DEPLOYMENT_URL:'https://' + url};
  const build = {uid:event.DEPLOYMENT_ID, projectId:project, url, target:'production',readyState:'READY',
    meta:{githubCommitRef:'main', githubCommitSha:sha}};
  verifyCandidate(event, build, settings);
  for (const wrong of [{uid:'dpl_new'}, {projectId:'other'}, {url:'different.example'}, {target:'preview'},
    {readyState:'BUILDING'}, {meta:{githubCommitRef:'branch', githubCommitSha:sha}}]) {
    assert.throws(() => verifyCandidate(event, {...build, ...wrong}, settings));
  }
  assert.throws(() => verifyCandidate({...event, MAIN_SHA:'a'.repeat(40)}, build, settings));
  assert.throws(() => verifyCandidate(event, build, {...settings, autoAssignCustomDomains:true}));
});

test('promotion writes only the tested ID and verifies both final assignments', async () => {
  const {release} = await import('../scripts/promote-tested-deployment.mjs');
  const sha = 'a'.repeat(40);
  const id = 'dpl_latest';
  const project = 'prj_eMZRdYAx6bcYaTmko8GHfr1tubaW';
  const hostname = 'styled-landing-latest-valorax-ai-s-projects.vercel.app';
  const env = {MAIN_SHA:sha, DEPLOYMENT_SHA:sha, DEPLOYMENT_URL:'https://' + hostname,
    DEPLOYMENT_ID:id, VERCEL_PROMOTION_TOKEN:'fixture'};
  const builds = [{uid:id, projectId:project, url:hostname, readyState:'READY', target:'production',
    meta:{githubCommitRef:'main', githubCommitSha:sha}}];
  let assigned = 'dpl_previous';
  let writes = 0;
  const lookup = async (url, options) => {
    assert.equal(url.origin, 'https://api.vercel.com');
    if (url.pathname.startsWith('/v13/deployments/')) return Response.json({id:assigned});
    if (url.pathname === '/v9/projects/' + project) return Response.json({id:project, autoAssignCustomDomains:false});
    if (url.pathname === '/v6/deployments') return Response.json({deployments:builds});
    assert.equal(url.pathname, '/v10/projects/' + project + '/promote/' + id);
    assert.equal(options.method, 'POST');
    assigned = id;
    writes++;
    return new Response(null, {status:204});
  };
  await assert.rejects(release({...env, DEPLOYMENT_ID:'dpl_previous'}, lookup));
  assert.equal(writes, 0);
  await release(env, lookup);
  await release(env, lookup);
  assert.equal(writes, 1);
});
