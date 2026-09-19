import { NextResponse } from "next/server";

// Submission now runs internally after ownership, plan, and credit checks.
export async function POST() {
  return NextResponse.json({ error: "Submit videos through /api/process" }, { status: 410 });
}
