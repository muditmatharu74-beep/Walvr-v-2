import { NextResponse } from "next/server";

// Rendering is started only by /api/process after account, ownership and credit checks.
export async function POST() {
  return NextResponse.json({ error: "Use the upload flow to create a video" }, { status: 410 });
}
