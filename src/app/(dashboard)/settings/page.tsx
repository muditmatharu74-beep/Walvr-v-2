import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import UpgradeButton from "@/components/UpgradeButton";
import SignOutButton from "@/components/SignOutButton";

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const plan = profile?.plan ?? "free";

  return (
    <main className="min-h-screen px-4 py-10">
      <div className="max-w-2xl mx-auto space-y-8">

        <div>
          <h1 className="text-3xl font-bold gradient-text">Settings</h1>
          <p className="text-muted-foreground mt-1">{user.email}</p>
        </div>

        {/* Plan */}
        <div className="glass rounded-2xl p-8 space-y-6">
          <div>
            <h2 className="text-xl font-semibold">Your Plan</h2>
            <p className="text-muted-foreground text-sm mt-1">
              You are on the{" "}
              <span className="text-primary font-semibold capitalize">
                {plan}
              </span>{" "}
              plan.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Free */}
            <div
              className={`rounded-xl p-5 border space-y-3 ${
                plan === "free"
                  ? "border-primary bg-primary/10"
                  : "border-border bg-muted"
              }`}
            >
              <div>
                <p className="font-semibold">Free</p>
                <p className="text-2xl font-bold mt-1">$0</p>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>3 videos/month</li>
                <li>Watermark</li>
                <li>1080p export</li>
              </ul>
              {plan === "free" && (
                <p className="text-xs text-primary font-medium">Current plan</p>
              )}
            </div>

            {/* Pro */}
            <div
              className={`rounded-xl p-5 border space-y-3 ${
                plan === "pro"
                  ? "border-primary bg-primary/10"
                  : "border-border bg-muted"
              }`}
            >
              <div>
                <p className="font-semibold">Pro</p>
                <p className="text-2xl font-bold mt-1">$19<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>20 videos/month</li>
                <li>No watermark</li>
                <li>1080p export</li>
              </ul>
              {plan === "pro" ? (
                <p className="text-xs text-primary font-medium">Current plan</p>
              ) : (
                <UpgradeButton
                  priceId={process.env.STRIPE_PRO_PRICE_ID!}
                  label="Upgrade to Pro"
                />
              )}
            </div>

            {/* Business */}
            <div
              className={`rounded-xl p-5 border space-y-3 ${
                plan === "business"
                  ? "border-primary bg-primary/10"
                  : "border-border bg-muted"
              }`}
            >
              <div>
                <p className="font-semibold">Business</p>
                <p className="text-2xl font-bold mt-1">$49<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
              </div>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>Unlimited videos</li>
                <li>No watermark</li>
                <li>4K export</li>
              </ul>
              {plan === "business" ? (
                <p className="text-xs text-primary font-medium">Current plan</p>
              ) : (
                <UpgradeButton
                  priceId={process.env.STRIPE_BUSINESS_PRICE_ID!}
                  label="Upgrade to Business"
                />
              )}
            </div>
          </div>
        </div>

        {/* Account */}
        <div className="glass rounded-2xl p-8 space-y-4">
          <h2 className="text-xl font-semibold">Account</h2>
          <SignOutButton />
        </div>

      </div>
    </main>
  );
}
