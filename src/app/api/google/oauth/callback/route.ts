import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { exchangeCodeForTokens } from "@/lib/google";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${process.env.APP_URL}/login`);

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(`${process.env.APP_URL}/settings?google=denied`);
  }

  const tokens = await exchangeCodeForTokens(code);
  const admin = createAdminClient();

  if (tokens.refresh_token) {
    await admin.from("google_tokens").upsert({
      id: 1,
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
      access_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    });
  } else {
    // Re-consent without a new refresh token — just refresh the access token.
    await admin
      .from("google_tokens")
      .update({
        access_token: tokens.access_token,
        access_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
  }

  return NextResponse.redirect(`${process.env.APP_URL}/settings?google=connected`);
}
