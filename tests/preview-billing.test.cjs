const test = require('node:test');
const assert = require('node:assert/strict');
const {run} = require('../scripts/check-preview-billing.cjs');
const scope = {VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'feature/neon-captions', VERCEL_PROJECT_ID: 'prj_kY2qEWWysNEfqRKzI7irzqRYs7eg'};
test('billing diagnostic rejects production before calling Stripe', async () => {
  let called = false;
  await assert.rejects(run({...scope, VERCEL_ENV: 'production'}, {prices: {retrieve() {called = true}}}), /scope mismatch/);
  assert.equal(called, false);
});
test('read-only price check detects interval, amount, and client/server mismatch without logging IDs or keys', async () => {
  const env = {...scope, STRIPE_PRO_PRICE_ID: 'private_id', NEXT_PUBLIC_STRIPE_PRO_PRICE_ID: 'different_id', NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_live_secret'};
  const logs = [];
  const result = await run(env, {prices: {retrieve: async () => ({active: true, currency: 'usd', unit_amount: 19000, recurring: {interval: 'year', interval_count: 1}, livemode: true})}}, x => logs.push(x));
  const pro = result.find(x => x.plan === 'pro');
  assert.equal(pro.matchingIds, false); assert.equal(pro.offerMatches, false);
  assert.equal(logs.join('').includes('private_id'), false);
  assert.equal(logs.join('').includes('pk_live_secret'), false);
});
