import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { subscriptionPlan, topupCredits } from "@/lib/billing/prices";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2024-06-20" });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const idOf = (value: string | { id: string } | null) => typeof value === "string" ? value : value?.id;

export async function POST(request: Request) {
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), request.headers.get("stripe-signature") ?? "", process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    const { data: receipt, error: receiptError } = await supabase.from("stripe_events").select("event_id").eq("event_id", event.id).maybeSingle();
    if (receiptError) throw receiptError;
    if (receipt) return NextResponse.json({ received: true });

    const apply = async (input: {
      key: string; customer: string; userId?: string; action: string;
      amount?: number; plan?: string; subscription?: string; period?: number;
    }) => {
      let userId = input.userId;
      if (!userId) {
        const { data, error } = await supabase.from("profiles").select("id").eq("stripe_customer_id", input.customer).single();
        if (error || !data) throw error ?? new Error("Customer is not linked yet");
        userId = data.id;
      }
      const { error } = await supabase.rpc("apply_stripe_credit_event", {
        p_event_id: event.id, p_key: input.key, p_user_id: userId, p_customer: input.customer,
        p_action: input.action, p_amount: input.amount ?? 0, p_plan: input.plan ?? "free",
        p_subscription: input.subscription ?? null, p_created: event.created, p_period: input.period ?? 0,
      });
      if (error) throw error;
    };

    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = await stripe.checkout.sessions.retrieve((event.data.object as Stripe.Checkout.Session).id);
        const customer = idOf(session.customer);
        if (!customer || !session.metadata?.user_id) throw new Error("Checkout identity missing");
        if (session.mode === "payment") {
          if (session.payment_status !== "paid") break;
          const items = await stripe.checkout.sessions.listLineItems(session.id, { limit: 2 });
          const credits = topupCredits(items.data[0]?.price?.id);
          if (items.has_more || items.data.length !== 1 || items.data[0].quantity !== 1 || !credits) throw new Error("Unrecognized top-up purchase");
          await apply({ key: `checkout:${session.id}`, customer, userId: session.metadata.user_id, action: "topup", amount: credits });
        } else if (session.mode === "subscription") {
          await apply({ key: `checkout:${session.id}`, customer, userId: session.metadata.user_id, action: "link" });
        }
        break;
      }
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        if (!invoice.paid || !["subscription_create", "subscription_cycle"].includes(invoice.billing_reason ?? "")) break;
        const subscriptionId = idOf(invoice.subscription);
        const customer = idOf(invoice.customer);
        if (!subscriptionId || !customer) throw new Error("Invoice subscription missing");
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        // Do not revive a canceled subscription or refill from an older billing period.
        if (!["active", "trialing"].includes(subscription.status)) break;
        const lines = invoice.lines.data.filter(line => line.type === "subscription" && !line.proration);
        if (invoice.lines.has_more || lines.length !== 1) throw new Error("Ambiguous subscription invoice");
        const line = lines[0];
        const entitlement = subscriptionPlan(line.price?.id);
        if (!entitlement || line.quantity !== 1) throw new Error("Unknown subscription price");
        if (line.period.start < subscription.current_period_start) break;
        await apply({ key: `invoice:${invoice.id}`, customer, userId: subscription.metadata.user_id,
          action: "renew", amount: entitlement.credits, plan: entitlement.plan,
          subscription: subscription.id, period: line.period.start });
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        // Retrieve current state because Stripe may deliver events out of order.
        const subscription = await stripe.subscriptions.retrieve((event.data.object as Stripe.Subscription).id);
        const customer = idOf(subscription.customer);
        if (!customer) throw new Error("Subscription customer missing");
        const active = ["active", "trialing"].includes(subscription.status);
        const entitlement = subscriptionPlan(subscription.items.data[0]?.price.id);
        if (active && !entitlement) throw new Error("Unknown subscription price");
        await apply({ key: `subscription-event:${event.id}`, customer, userId: subscription.metadata.user_id,
          action: active ? "plan" : "cancel", plan: active ? entitlement!.plan : "free", subscription: subscription.id });
        break;
      }
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    // No receipt is committed on a failed transaction; Stripe can safely retry.
    console.error("Stripe fulfillment failed", { eventId: event.id, error });
    return NextResponse.json({ error: "Fulfillment failed; retry required" }, { status: 500 });
  }
}
