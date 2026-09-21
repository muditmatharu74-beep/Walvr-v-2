const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks = {}) {
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file,'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code,{module:mod,exports:mod.exports,require:id=>mocks[id]??require(id),process,console:{error(){}}});
  return mod.exports;
}
process.env.STRIPE_TOPUP_500_PRICE_ID='price_500';
process.env.STRIPE_STARTER_PRICE_ID='price_starter';
const prices=load('src/lib/billing/prices.ts');
const request=()=>new Request('https://test/api/webhook/stripe',{method:'POST',body:'signed',headers:{'stripe-signature':'test'}});
function setup({ type='checkout.session.completed', paid=true, quantity=1, price='price_500', receipt=false, dbError=false, signatureError=false }={}) {
  const writes=[];
  const session={id:'cs_1',customer:'cus_1',mode:'payment',payment_status:paid?'paid':'unpaid',metadata:{user_id:'user_1',topup_credits:'9999999'}};
  const event={id:'evt_1',created:100,type,data:{object:session}};
  const db={from(){const q={select(){return q},eq(){return q},maybeSingle:async()=>({data:receipt?{event_id:'evt_1'}:null,error:null})};return q},async rpc(name,args){writes.push({name,args});return {error:dbError?new Error('database unavailable'):null}}};
  const stripe={webhooks:{constructEvent(){if(signatureError)throw Error('bad signature');return event}},checkout:{sessions:{retrieve:async()=>session,listLineItems:async()=>({data:[{price:{id:price},quantity}],has_more:false})}}};
  const mocks={'stripe':class{constructor(){return stripe}},'@supabase/supabase-js':{createClient:()=>db},'@/lib/billing/prices':prices,'next/server':{NextResponse:{json:(body,init)=>Response.json(body,init)}}};
  return {route:load('src/app/api/webhook/stripe/route.ts',mocks),writes,mocks};
}
test('configured Stripe price determines topup, ignoring attacker credit metadata',async()=>{
  const s=setup();assert.equal((await s.route.POST(request())).status,200);
  assert.equal(s.writes[0].args.p_amount,500);assert.equal(s.writes[0].args.p_key,'checkout:cs_1');
});
test('unpaid and invalid-signature sessions cannot grant credits',async()=>{
  for(const options of [{paid:false},{signatureError:true}]){const s=setup(options);await s.route.POST(request());assert.equal(s.writes.length,0)}
});
test('unknown prices and unexpected quantities fail closed',async()=>{
  for(const options of [{price:'price_forged'},{quantity:2}]){const s=setup(options);assert.equal((await s.route.POST(request())).status,500);assert.equal(s.writes.length,0)}
});
test('database failures return retryable 500, while recorded events skip fulfillment',async()=>{
  const s=setup({dbError:true});assert.equal((await s.route.POST(request())).status,500);
  const duplicate=setup({receipt:true});assert.equal((await duplicate.route.POST(request())).status,200);assert.equal(duplicate.writes.length,0);
});
test('different success event types share the same business idempotency key',async()=>{
  const a=setup(),b=setup({type:'checkout.session.async_payment_succeeded'});
  await a.route.POST(request());await b.route.POST(request());assert.equal(a.writes[0].args.p_key,b.writes[0].args.p_key);
});
test('price allowlist rejects empty, missing and unrecognized prices',()=>{
  for(const value of ['',undefined,'forged',500]){assert.equal(prices.topupCredits(value),undefined);assert.equal(prices.subscriptionPlan(value),undefined)}
  assert.equal(prices.subscriptionPlan('price_starter').credits,1500);
});
test('unsigned Creatomate callbacks cannot forge refunds or successful renders',async()=>{
  const s=setup();const route=load('src/app/api/webhook/creatomate/route.ts',s.mocks);
  assert.equal((await route.POST()).status,410);assert.equal(s.writes.length,0);
});
