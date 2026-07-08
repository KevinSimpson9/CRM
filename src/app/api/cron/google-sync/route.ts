import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncCalendar, syncGmail } from "@/lib/google-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Daily Vercel Cron (Hobby tier allows 2 daily crons). Use "Sync now" in
// Settings for an on-demand run between crons.
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const results: Record<string, unknown> = {};
  try {
    results.gmail = await syncGmail(admin);
  } catch (e) {
    results.gmail = { error: (e as Error).message };
  }
  try {
    results.calendar = await syncCalendar(admin);
  } catch (e) {
    results.calendar = { error: (e as Error).message };
  }
  return NextResponse.json({ ok: true, results });
}
