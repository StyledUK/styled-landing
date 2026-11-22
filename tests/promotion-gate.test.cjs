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
