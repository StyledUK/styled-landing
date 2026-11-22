const {test} = require('node:test');
const assert = require('node:assert/strict');

const first = {DEPLOYMENT_ID:'dpl_first', DEPLOYMENT_URL:'https://styled-landing-first-valorax-ai-s-projects.vercel.app', DEPLOYMENT_SHA:'a'.repeat(40)};

test('same-revision builds have distinct receipts for the reviewer', async () => {
  const {productionSmokeReceipt} = await import('../scripts/production-smoke-receipt.mjs');
  const second = {...first, DEPLOYMENT_ID:'dpl_second', DEPLOYMENT_URL:first.DEPLOYMENT_URL.replace('first', 'second')};
  assert.match(productionSmokeReceipt(first), /dpl_first/);
  const receipt = productionSmokeReceipt(second);
  for (const value of Object.values(second)) assert.ok(receipt.includes(value));
  assert.ok(!receipt.includes(first.DEPLOYMENT_ID));
});

test('a receipt requires a valid ID, revision and immutable project URL', async () => {
  const {productionSmokeReceipt} = await import('../scripts/production-smoke-receipt.mjs');
  for (const invalid of [{DEPLOYMENT_ID:''}, {DEPLOYMENT_URL:'https://styleduk.com'}, {DEPLOYMENT_SHA:'main'}]) {
    assert.throws(() => productionSmokeReceipt({...first, ...invalid}));
  }
});
