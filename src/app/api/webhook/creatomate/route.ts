import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { id, status, url } = body;

    if (!id) {
      return NextResponse.json({ error: "No render ID" }, { status: 400 });
    }

    const supabase = await createClient();

    if (status === "succeeded") {
      await supabase
        .from("videos")
        .update({
          status: "done",
          render_url: url,
        })
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
