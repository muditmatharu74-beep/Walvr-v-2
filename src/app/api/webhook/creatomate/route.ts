import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, status, url } = body;

    if (!id) {
      return NextResponse.json({ error: "No render ID" }, { status: 400 });
    }

    if (status === "succeeded") {
      await supabase
        .from("videos")
        .update({ status: "done", render_url: url })
        .eq("render_id", id);
    }

    if (status === "failed") {
      await supabase
        .from("videos")
        .update({ status: "error" })
        .eq("render_id", id);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Creatomate webhook error:", err);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}
