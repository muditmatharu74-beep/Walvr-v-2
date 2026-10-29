import {createClient} from "@supabase/supabase-js";
import {NextResponse} from "next/server";
import {z} from "zod";
import {vocalWorkerAuthorized, completeVocalAnalysis, resumeVocalRender} from "@/lib/rendering/vocal-jobs";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const lease = {videoId: z.string().uuid(), token: z.string().uuid()};
const schema = z.discriminatedUnion("action", [
  z.object({action: z.literal("claim")}),
  z.object({action: z.literal("heartbeat"), ...lease}),
  z.object({action: z.literal("complete"), ...lease, result: z.unknown(), originalDuration: z.number().positive().max(600)}),
  z.object({action: z.literal("fail"), ...lease, reason: z.enum(["input_invalid", "analysis_failed"])}),
]);

export async function POST(request: Request) {
  if (!vocalWorkerAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json({error: "Unauthorized"}, {status: 401});
  }
  // Bounded JSON body. The worker result contains private lyrics; never log it.
  let total = 0;
  const chunks: Uint8Array[] = [];
  const reader = request.body?.getReader();
  if (!reader) return NextResponse.json({error: "Invalid worker request"}, {status: 400});
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > 2_000_000) {await reader.cancel(); return NextResponse.json({error: "Result too large"}, {status: 413});}
      chunks.push(value);
    }
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({error: "Invalid worker request"}, {status: 400});
    const input = parsed.data;
    if (input.action === "claim") {
      // Durable ready results resume without the browser or redoing recognition.
      await resumeVocalRender(db);
      const {data, error} = await db.rpc("claim_vocal_analysis");
      if (error) throw error;
      return NextResponse.json({job: data});
    }
    if (input.action === "complete") {
      const result = await completeVocalAnalysis(db, {...input, result: input.result});
      // A ready result remains persisted if this process exits before submission.
      return NextResponse.json(result);
    }
    const {data, error} = await db.rpc(input.action === "heartbeat" ? "heartbeat_vocal_analysis" : "fail_vocal_analysis", {
      p_video_id: input.videoId, p_token: input.token,
      ...(input.action === "fail" ? {p_reason: input.reason} : {}),
    });
    if (error) throw error;
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({error: "Worker request could not be processed"}, {status: 503});
  }
}
