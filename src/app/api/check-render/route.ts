import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { renderId, videoId } = await request.json();

    const res = await fetch(
      `https://api.creatomate.com/v1/renders/${renderId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.CREATOMATE_API_KEY}`,
        },
      }
    );

    if (!res.ok) throw new Error("Failed to fetch render status");

    const render = await res.json();

    if (render.status === "succeeded") {
      await supabase
        .from("videos")
        .update({ status: "done", render_url: render.url })
        .eq("id", videoId);

      return NextResponse.json({ status: "done", url: render.url });
    }

    if (render.status === "failed") {
      await supabase
        .from("videos")
        .update({ status: "error" })
        .eq("id", videoId);

      return NextResponse.json({ status: "error" });
    }

    return NextResponse.json({ status: "rendering" });
  } catch (err) {
    console.error("Check render error:", err);
    return NextResponse.json({ error: "Check failed" }, { status: 500 });
  }
}
