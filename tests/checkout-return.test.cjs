const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, env, mocks = {}) {
  const mod = {exports: {}};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  }}).outputText;
  vm.runInNewContext(code, {module: mod, exports: mod.exports,
    require: id => mocks[id] ?? require(id), process: {env}, URL,
    console: {error() {}},
  });
  return mod.exports;
}

async function submit(kind, env, authenticated = true) {
  const calls = [];
  const stripe = {checkout: {sessions: {create: async args => {
    calls.push(args); return {url: 'https://checkout.stripe.com/example'};
  }}}};
  const q = {select() {return q}, eq() {return q},
    single: async () => ({data: {stripe_customer_id: null}, error: null})};
  const db = {auth: {getUser: async () => ({data: {user: authenticated ? {id: 'owner'} : null}})}, from: () => q};
  const mocks = {
    stripe: class {constructor() {return stripe}},
    '@/lib/supabase/server': {createClient: async () => db},
    '@/lib/billing/prices': {subscriptionPlan: () => ({plan: 'pro', credits: 3000}), topupCredits: () => 500},
    '@/lib/billing/checkout-origin': load('src/lib/billing/checkout-origin.ts', env),
    'next/server': {NextResponse: {json: (body, init) => Response.json(body, init)}},
  };
  const route = load(`src/app/api/${kind}/route.ts`, env, mocks);
  const response = await route.POST(new Request('https://attacker.example/api/' + kind, {
    method: 'POST', headers: {Origin: 'https://attacker.example', Host: 'attacker.example'},
    body: JSON.stringify({priceId: 'configured', returnUrl: 'https://attacker.example'}),
  }));
  return {response, calls};
}

test('subscriptions and top-ups return to the preview deployment, ignoring client return URLs', async () => {
  for (const kind of ['checkout', 'topup']) {
    const result = await submit(kind, {VERCEL_ENV: 'preview', VERCEL_URL: 'walvr-reviewed.vercel.app',
      NEXT_PUBLIC_APP_URL: 'https://main.example'});
    assert.equal(result.response.status, 200);
    assert.equal(result.calls[0].success_url, `https://walvr-reviewed.vercel.app/dashboard?${kind === 'checkout' ? 'upgraded=true' : 'topup=success'}`);
    assert.equal(result.calls[0].cancel_url, 'https://walvr-reviewed.vercel.app/settings');
  }
});

test('missing or malformed preview configuration fails before creating a Stripe session', async () => {
  for (const kind of ['checkout', 'topup']) for (const hostname of [undefined, 'evil.example', 'ok.vercel.app/path', 'ok.vercel.app@evil.example']) {
    const result = await submit(kind, {VERCEL_ENV: 'preview', VERCEL_URL: hostname, NEXT_PUBLIC_APP_URL: 'https://main.example'});
    assert.equal(result.response.status, 500);
    assert.equal(result.calls.length, 0);
  }
});

test('production uses its configured HTTPS origin; untrusted configuration fails closed', async () => {
  for (const kind of ['checkout', 'topup']) {
    const result = await submit(kind, {VERCEL_ENV: 'production', NODE_ENV: 'production', NEXT_PUBLIC_APP_URL: 'https://walvr.example/'});
    assert.equal(result.response.status, 200);
    assert.equal(result.calls[0].cancel_url, 'https://walvr.example/settings');
    for (const url of [undefined, 'http://walvr.example', 'https://user:pass@walvr.example', 'https://walvr.example/extra', 'https://walvr.example?next=evil']) {
      const failed = await submit(kind, {VERCEL_ENV: 'production', NODE_ENV: 'production', NEXT_PUBLIC_APP_URL: url});
      assert.equal(failed.response.status, 500);
      assert.equal(failed.calls.length, 0);
    }
  }
});

test('unauthenticated checkout cannot create a payment session', async () => {
  for (const kind of ['checkout', 'topup']) {
    const result = await submit(kind, {VERCEL_ENV: 'preview', VERCEL_URL: 'walvr-reviewed.vercel.app'}, false);
    assert.equal(result.response.status, 401);
    assert.equal(result.calls.length, 0);
  }
});
