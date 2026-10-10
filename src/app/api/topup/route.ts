import { topupCredits } from "@/lib/billing/prices";
import { checkoutOrigin } from "@/lib/billing/checkout-origin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
});

export async function POST(request: Request) {
  try {
    const { priceId } = await request.json();

    if (!topupCredits(priceId)) return NextResponse.json({ error: "Unknown price" }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

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
      mode: "payment",
      ...(!profile.stripe_customer_id ? { customer_creation: "always" as const } : {}),
      payment_method_types: ["card"],
      customer: profile?.stripe_customer_id ?? undefined,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: {
        user_id: user.id,
      },
      success_url: `${origin}/dashboard?topup=success`,
      cancel_url: `${origin}/settings`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Topup error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
