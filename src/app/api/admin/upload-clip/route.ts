import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const ADMIN_USER_ID = "9e87c63d-2535-4a00-be94-6dae6899a4ab";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || user.id !== ADMIN_USER_ID) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const mood = formData.get("mood") as string;
    const energy = formData.get("energy") as string;
    const vibe = formData.get("vibe") as string;

    if (!file) {
      return NextResponse.json({ error: "No file" }, { status: 400 });
    }

    const key = `${vibe.toLowerCase().replace(/\s+/g, "-").replace(/&/g, "and")}/${Date.now()}-${file.name}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
      requestChecksumCalculation: "WHEN_REQUIRED" as any,
      responseChecksumValidation: "WHEN_REQUIRED" as any,
    });

    await client.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: buffer,
      ContentType: file.type,
    }));

    const clipUrl = `${process.env.R2_PUBLIC_URL}/${key}`;
    return NextResponse.json({ clipUrl });
  } catch (err) {
    console.error("Upload clip error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
