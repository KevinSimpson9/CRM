import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildDigest } from "@/lib/digest";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// Vercel Cron hits this daily (13:00 UTC ≈ 6 AM PT during DST; see README).
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const digest = await buildDigest(supabase);
  await sendEmail(digest);
  return NextResponse.json({ ok: true, subject: digest.subject });
}
