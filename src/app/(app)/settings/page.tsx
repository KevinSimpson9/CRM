import { createAdminClient } from "@/lib/supabase/admin";
import GoogleControls from "@/components/GoogleControls";
import MailerLiteControls from "@/components/MailerLiteControls";
import { fmtDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const admin = createAdminClient();
  const [{ data: googleToken }, { data: syncStates }, { data: deals }] = await Promise.all([
    admin.from("google_tokens").select("id, google_email, updated_at").eq("id", 1).maybeSingle(),
    admin.from("sync_state").select("*"),
    admin.from("deals").select("id, name").order("created_at"),
  ]);
  const mlConfigured = !!process.env.MAILERLITE_API_KEY;

  const sync: Record<string, string | null> = {};
  for (const s of (syncStates as any[]) || []) sync[s.key] = s.last_synced_at;

  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-xl font-semibold">Settings &amp; integrations</h1>

      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">Google (Gmail · Calendar · Contacts)</div>
          <span className={googleToken ? "chip-teal" : "chip"}>
            {googleToken ? "connected" : "not connected"}
          </span>
        </div>
        <p className="text-xs text-muted">
          Gmail: only messages to/from known contact emails are logged (metadata + snippet — never
          the full mailbox). Calendar: past events with known contacts become meeting interactions;
          upcoming ones appear on the dashboard. Contacts: one-way import, never writes back.
          Auto-sync runs daily via Vercel Cron; use “Sync now” anytime.
        </p>
        <div className="text-xs text-muted space-x-4">
          <span>Gmail last sync: {sync.gmail ? fmtDateTime(sync.gmail) : "never"}</span>
          <span>Calendar last sync: {sync.gcal ? fmtDateTime(sync.gcal) : "never"}</span>
        </div>
        <GoogleControls connected={!!googleToken} />
      </div>

      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">MailerLite</div>
          <span className={mlConfigured ? "chip-teal" : "chip"}>
            {mlConfigured ? "API key set" : "no API key"}
          </span>
        </div>
        <p className="text-xs text-muted">
          Two-way: pull subscribers/groups and match to contacts by email; push a contact segment
          (e.g. “Avenue NDA signers”) into a MailerLite group. Free tier limit: 1,000 subscribers.
          Last sync: {sync.mailerlite ? fmtDateTime(sync.mailerlite) : "never"}.
        </p>
        {mlConfigured ? (
          <MailerLiteControls deals={((deals as any[]) || []).map((d) => ({ id: d.id, name: d.name }))} />
        ) : (
          <p className="text-xs text-muted">Set MAILERLITE_API_KEY in your environment to enable.</p>
        )}
      </div>
    </div>
  );
}
