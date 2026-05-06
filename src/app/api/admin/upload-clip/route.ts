import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const ADMIN_USER_ID = "9e87c63d-2535-4a00-be94-6dae6899a4ab";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || user.id !== ADMIN_USER_ID) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { fileName, fileType, mood, energy, vibe } = await request.json();

    const key = `${vibe.toLowerCase().replace(/\s+/g, "-").replace(/&/g, "and")}/${Date.now()}-${fileName}`;

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

    const uploadUrl = await getSignedUrl(client, command, {
      expiresIn: 3600,
      unhoistableHeaders: new Set(["x-amz-checksum-crc32"]),
    });

    const clipUrl = `${process.env.R2_PUBLIC_URL}/${key}`;
    return NextResponse.json({ uploadUrl, clipUrl });
  } catch (err) {
    console.error("Upload clip error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
