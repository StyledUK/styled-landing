import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';

export function productionSmokeReceipt({DEPLOYMENT_ID, DEPLOYMENT_URL, DEPLOYMENT_SHA}) {
  assert.match(DEPLOYMENT_ID ?? '', /^dpl_[A-Za-z0-9]+$/);
  assert.match(DEPLOYMENT_URL ?? '', /^https:\/\/styled-landing-[a-z0-9]+-valorax-ai-s-projects\.vercel\.app$/);
  assert.match(DEPLOYMENT_SHA ?? '', /^[a-f0-9]{40}$/);
  return [
    '### Production smoke checks passed',
    '',
    'Match this build to the newest Ready production deployment from main before promoting it in Vercel.',
    '',
    'Deployment ID: `' + DEPLOYMENT_ID + '`',
    '',
    'Tested URL: ' + DEPLOYMENT_URL,
    '',
    'Revision: `' + DEPLOYMENT_SHA + '`',
  ].join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(productionSmokeReceipt(process.env));
}
