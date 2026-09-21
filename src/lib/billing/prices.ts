// Only configured, nonempty Stripe price IDs can determine entitlements.
export function topupCredits(priceId: unknown): number | undefined {
  if (typeof priceId !== 'string' || !priceId) return undefined;
  for (const credits of [500, 1500, 5000, 12000]) {
    if (process.env[`STRIPE_TOPUP_${credits}_PRICE_ID`] === priceId) return credits;
  }
}
export function subscriptionPlan(priceId: unknown): { plan: string; credits: number } | undefined {
  if (typeof priceId !== 'string' || !priceId) return undefined;
  for (const [plan, credits] of Object.entries({ starter: 1500, pro: 3000, business: 8000, studio: 15000 })) {
    if (process.env[`STRIPE_${plan.toUpperCase()}_PRICE_ID`] === priceId) return { plan, credits };
  }
}
