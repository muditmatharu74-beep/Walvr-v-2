"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={loading}
      className="px-5 py-2.5 glass rounded-lg font-semibold hover:bg-white/10 transition-colors disabled:opacity-50 text-sm"
    >
      {loading ? "Signing out..." : "Sign Out"}
    </button>
  );
}
