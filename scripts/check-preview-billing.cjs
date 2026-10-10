// Explicit, read-only diagnostic. Never creates a checkout, payment, customer,
// webhook event, or credit transaction; never included in the normal build.
function validate(env) {
  if (env.VERCEL_ENV !== 'preview' || env.VERCEL_GIT_COMMIT_REF !== 'feature/neon-captions' ||
      env.VERCEL_PROJECT_ID !== 'prj_kY2qEWWysNEfqRKzI7irzqRYs7eg') {
    throw Error('Preview billing diagnostic scope mismatch');
  }
}

async function run(env, stripe, log = console.log) {
  validate(env);
  const results = [];
  for (const [plan, amount] of Object.entries({starter: 900, pro: 1900, business: 4900})) {
    const key = plan.toUpperCase();
    const serverId = env[`STRIPE_${key}_PRICE_ID`];
    const publicId = env[`NEXT_PUBLIC_STRIPE_${key}_PRICE_ID`];
    const result = {plan, configured: Boolean(serverId && publicId), matchingIds: Boolean(serverId && serverId === publicId)};
    if (serverId) {
      try {
        const price = await stripe.prices.retrieve(serverId);
        Object.assign(result, {active: price.active, currency: price.currency, amount: price.unit_amount,
          interval: price.recurring?.interval, intervalCount: price.recurring?.interval_count,
          mode: price.livemode ? 'live' : 'test',
          offerMatches: price.active && price.currency === 'usd' && price.unit_amount === amount &&
            price.recurring?.interval === 'month' && price.recurring?.interval_count === 1,
          publishableModeMatches: Boolean(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.startsWith(price.livemode ? 'pk_live_' : 'pk_test_'))});
      } catch (error) {
        result.errorType = error.type || error.name || 'request_failed';
        result.status = error.statusCode;
      }
    }
    results.push(result);
    log('BILLING_PRICE_CHECK ' + JSON.stringify(result));
  }
  return results;
}

module.exports = {validate, run};
if (require.main === module) {
  try { validate(process.env); } catch (error) {console.error(error.message); process.exit(1);}
  const Stripe = require('stripe');
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {apiVersion: '2024-06-20', timeout: 15000, maxNetworkRetries: 1});
  run(process.env, stripe).catch(() => {console.error('Billing diagnostic could not complete'); process.exitCode = 1;});
}
