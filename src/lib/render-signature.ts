import { createHmac, timingSafeEqual } from "node:crypto";

type RenderIdentity = { videoId: string; userId: string; renderId: string };
type Metadata = { provider: string; bucketName: string; functionName: string; region: string };

export function signRenderMetadata(identity: RenderIdentity, metadata: Metadata): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Missing server key for render tracking");
  // Videos are user-editable. Bind Lambda tracking to the server-created job and owner.
  return createHmac("sha256", key).update(JSON.stringify([
    "walvr-render-v1", identity.videoId, identity.userId, identity.renderId,
    metadata.provider, metadata.bucketName, metadata.functionName, metadata.region,
  ])).digest("hex");
}

export function verifyRenderMetadata(identity: RenderIdentity, metadata: Metadata & { signature?: string }): boolean {
  if (typeof metadata.signature !== "string" || !/^[a-f0-9]{64}$/.test(metadata.signature)) return false;
  return timingSafeEqual(Buffer.from(metadata.signature, "hex"), Buffer.from(signRenderMetadata(identity, metadata), "hex"));
}
