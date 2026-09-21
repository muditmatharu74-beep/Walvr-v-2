import { NextResponse } from "next/server";
// Completion and refunds use authenticated polling of the provider API.
// The former unsigned callback allowed callers to forge terminal states.
export async function POST() {
  return NextResponse.json({ error: "Use authenticated render polling" }, { status: 410 });
}
