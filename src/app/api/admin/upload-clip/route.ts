import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || user.id !== "9e87c63d-2535-4a00-be94-6dae6899a4ab") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { fileName, fileType, mood, energy, vibe } = await request.json();

    const key = `${vibe.toLowerCase().replace(/\s+/g, "-")}/${Date.now()}-${fileName}`;

    // Generate presigned upload URL for R2
    const r2Url = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_BUCKET_NAME}/${key}`;

    const uploadUrl = await getPresignedUrl(key, fileType);
    const clipUrl = `${process.env.R2_PUBLIC_URL}/${key}`;

    return NextResponse.json({ uploadUrl, clipUrl });
  } catch (err) {
    console.error("Upload clip error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

async function getPresignedUrl(key: string, fileType: string) {
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: key,
    ContentType: fileType,
  });

  return getSignedUrl(client, command, { expiresIn: 3600 });
}
