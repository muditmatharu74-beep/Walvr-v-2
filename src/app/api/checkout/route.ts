import { subscriptionPlan } from "@/lib/billing/prices";
import { checkoutOrigin } from "@/lib/billing/checkout-origin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

export async function POST(request: Request) {
  try {
    const { priceId: suppliedPriceId, planId } = await request.json();
    // New clients choose a plan; only the server selects its configured price.
    // Keep the allowlisted price-ID path for older tabs.
    if (planId !== undefined && !["starter", "pro", "business", "studio"].includes(planId)) {
      return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
    }
    const priceId = planId === undefined ? suppliedPriceId : process.env[`STRIPE_${planId.toUpperCase()}_PRICE_ID`];

    if (!subscriptionPlan(priceId)) return NextResponse.json({ error: "Unknown price" }, { status: 400 });

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not logged in" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) throw profileError ?? new Error("Profile not found");

    const origin = checkoutOrigin();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      subscription_data: { metadata: { user_id: user.id } },
      payment_method_types: ["card"],
      customer: profile?.stripe_customer_id ?? undefined,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      metadata: {
        user_id: user.id,
      },
      success_url: `${origin}/dashboard?upgraded=true`,
      cancel_url: `${origin}/settings`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Checkout error:", err);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
