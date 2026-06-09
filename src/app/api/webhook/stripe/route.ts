import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PLAN_CREDITS: Record<string, number> = {
  starter: 1500,
  pro: 3000,
  business: 8000,
  studio: 15000,
};

const TOPUP_CREDITS: Record<string, number> = {
  [process.env.STRIPE_TOPUP_500_PRICE_ID ?? ""]: 500,
  [process.env.STRIPE_TOPUP_1500_PRICE_ID ?? ""]: 1500,
  [process.env.STRIPE_TOPUP_5000_PRICE_ID ?? ""]: 5000,
  [process.env.STRIPE_TOPUP_12000_PRICE_ID ?? ""]: 12000,
};

export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Stripe webhook signature failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {

    // New subscription or plan change
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      const priceId = subscription.items.data[0].price.id;

      let plan = "free";
      if (priceId === process.env.STRIPE_STARTER_PRICE_ID) plan = "starter";
      if (priceId === process.env.STRIPE_PRO_PRICE_ID) plan = "pro";
      if (priceId === process.env.STRIPE_BUSINESS_PRICE_ID) plan = "business";
      if (priceId === process.env.STRIPE_STUDIO_PRICE_ID) plan = "studio";

      const credits = PLAN_CREDITS[plan] ?? 0;

      await supabase
        .from("profiles")
        .update({
          plan,
          stripe_subscription_id: subscription.id,
          credits,
          credits_reset_date: new Date().toISOString(),
        })
        .eq("stripe_customer_id", customerId);

      break;
    }

    // Monthly renewal — reset credits
    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;
      const billingReason = invoice.billing_reason;

      // Only reset on recurring renewals, not first payment
      if (billingReason === "subscription_cycle") {
        const { data: profile } = await supabase
          .from("profiles")
          .select("plan")
          .eq("stripe_customer_id", customerId)
          .single();

        if (profile?.plan && PLAN_CREDITS[profile.plan]) {
          await supabase
            .from("profiles")
            .update({
              credits: PLAN_CREDITS[profile.plan],
              credits_reset_date: new Date().toISOString(),
            })
            .eq("stripe_customer_id", customerId);
        }
      }

      // Handle top-up one time payments
      if (billingReason === "manual" || invoice.metadata?.topup) {
        const lineItem = invoice.lines?.data?.[0];
        const priceId = lineItem?.price?.id ?? "";
        const topupCredits = TOPUP_CREDITS[priceId];

        if (topupCredits) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("credits")
            .eq("stripe_customer_id", customerId)
            .single();

          const currentCredits = profile?.credits ?? 0;
          await supabase
            .from("profiles")
            .update({ credits: currentCredits + topupCredits })
            .eq("stripe_customer_id", customerId);
        }
      }

      break;
    }

    // Subscription cancelled
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      await supabase
        .from("profiles")
        .update({ plan: "free", stripe_subscription_id: null, credits: 0 })
        .eq("stripe_customer_id", customerId);

      break;
    }

    // Checkout completed — save customer ID and handle top-ups
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerId = session.customer as string;
      const userId = session.metadata?.user_id;
      const topupCredits = session.metadata?.topup_credits;

      if (userId) {
        await supabase
          .from("profiles")
          .update({ stripe_customer_id: customerId })
          .eq("id", userId);
      }

      // Handle top-up checkout
      if (topupCredits && userId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("credits")
          .eq("id", userId)
          .single();

        const currentCredits = profile?.credits ?? 0;
        await supabase
          .from("profiles")
          .update({ credits: currentCredits + parseInt(topupCredits) })
          .eq("id", userId);
      }

      break;
    }
  }

  return NextResponse.json({ received: true });
}
