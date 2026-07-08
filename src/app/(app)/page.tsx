import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import QuickLogPicker from "@/components/QuickLogPicker";
import { PIPELINE_STAGES, STAGE_LABELS, type PipelineStage } from "@/lib/types";
import { fmtDate, fmtDateTime, relTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface KeyDateItem {
  label: string;
  date: string;
  dealName: string;
  contactName: string;
}

export default async function Dashboard() {
  const supabase = createClient();
  const now = new Date();
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  const in14d = new Date(now.getTime() + 14 * 86400000);

  const [remindersRes, interactionsRes, profilesRes, participationsRes, birthdaysRes, meetingsRes] =
    await Promise.all([
      supabase
        .from("reminders")
        .select("*, contacts(name), deals(name)")
        .neq("status", "done")
        .lte("due_at", endOfToday.toISOString())
        .order("due_at")
        .limit(30),
      supabase
        .from("interactions")
        .select("id, channel, direction, occurred_at, subject, body, contacts(id, name)")
        .order("occurred_at", { ascending: false })
        .limit(8),
      supabase.from("investor_profiles").select("pipeline_stage"),
      supabase
        .from("deal_participations")
        .select("key_dates, deals(name), contacts(name)")
        .neq("key_dates", "[]"),
      supabase.from("contacts").select("id, name, birthday").not("birthday", "is", null),
      supabase
        .from("calendar_events")
        .select("*")
        .gte("starts_at", now.toISOString())
        .order("starts_at")
        .limit(5),
    ]);

  const reminders = (remindersRes.data || []).filter(
    (r: any) => r.status === "pending" || (r.snoozed_until && new Date(r.snoozed_until) <= now)
  );

  const stageCounts: Record<string, number> = {};
  for (const p of profilesRes.data || []) {
    stageCounts[p.pipeline_stage] = (stageCounts[p.pipeline_stage] || 0) + 1;
  }

  const keyDates: KeyDateItem[] = [];
  for (const p of (participationsRes.data as any[]) || []) {
    for (const kd of p.key_dates || []) {
      const d = new Date(kd.date + "T12:00:00");
      if (d >= now && d <= in14d) {
        keyDates.push({
          label: kd.label,
          date: kd.date,
          dealName: p.deals?.name,
          contactName: p.contacts?.name,
        });
      }
    }
  }
  keyDates.sort((a, b) => a.date.localeCompare(b.date));

  const upcomingBirthdays = ((birthdaysRes.data as any[]) || [])
    .map((c) => {
      const bd = new Date(c.birthday + "T12:00:00");
      const next = new Date(now.getFullYear(), bd.getMonth(), bd.getDate(), 12);
      if (next < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
        next.setFullYear(next.getFullYear() + 1);
      }
      return { ...c, next };
    })
    .filter((c) => c.next.getTime() - now.getTime() < 7 * 86400000)
    .sort((a, b) => a.next.getTime() - b.next.getTime());

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Today</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <QuickLogPicker />

          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs uppercase tracking-wide text-muted">Due &amp; overdue</div>
              <Link href="/reminders" className="text-xs text-teal hover:underline">
                all reminders →
              </Link>
            </div>
            {reminders.length === 0 && (
              <div className="text-sm text-muted">Nothing due. Clear runway.</div>
            )}
            <div className="space-y-2">
              {reminders.map((r: any) => (
                <div key={r.id} className="flex items-baseline gap-2 text-sm">
                  <span className={new Date(r.due_at) < now ? "text-gold" : "text-teal"}>
                    {relTime(r.due_at)}
                  </span>
                  <span>{r.title}</span>
                  {r.contacts && (
                    <Link href={`/contacts/${r.contact_id}`} className="text-teal hover:underline">
                      {r.contacts.name}
                    </Link>
                  )}
                  {r.deals && <span className="chip">{r.deals.name}</span>}
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="text-xs uppercase tracking-wide text-muted mb-3">Recent interactions</div>
            <div className="space-y-2">
              {(interactionsRes.data as any[])?.map((i) => (
                <div key={i.id} className="text-sm flex items-baseline gap-2">
                  <span className="text-muted text-xs w-24 shrink-0">{fmtDateTime(i.occurred_at)}</span>
                  <span className="capitalize text-muted">{i.channel}</span>
                  <Link href={`/contacts/${i.contacts?.id}`} className="text-teal hover:underline shrink-0">
                    {i.contacts?.name}
                  </Link>
                  <span className="text-muted truncate">{i.subject || i.body}</span>
                </div>
              ))}
              {(interactionsRes.data || []).length === 0 && (
                <div className="text-sm text-muted">No interactions yet.</div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs uppercase tracking-wide text-muted">Pipeline</div>
              <Link href="/pipeline" className="text-xs text-teal hover:underline">
                board →
              </Link>
            </div>
            <div className="space-y-1.5">
              {PIPELINE_STAGES.map((s: PipelineStage) => (
                <div key={s} className="flex justify-between text-sm">
                  <span className="text-muted">{STAGE_LABELS[s]}</span>
                  <span className={stageCounts[s] ? "text-ink font-medium" : "text-muted/50"}>
                    {stageCounts[s] || 0}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {keyDates.length > 0 && (
            <div className="card">
              <div className="text-xs uppercase tracking-wide text-muted mb-3">
                Key dates (14 days)
              </div>
              <div className="space-y-2">
                {keyDates.map((k, i) => (
                  <div key={i} className="text-sm">
                    <span className="text-gold">{fmtDate(k.date)}</span> — {k.label}
                    <div className="text-xs text-muted">
                      {k.contactName} · {k.dealName}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {upcomingBirthdays.length > 0 && (
            <div className="card">
              <div className="text-xs uppercase tracking-wide text-muted mb-3">Birthdays (7 days)</div>
              {upcomingBirthdays.map((b: any) => (
                <div key={b.id} className="text-sm">
                  🎂{" "}
                  <Link href={`/contacts/${b.id}`} className="text-teal hover:underline">
                    {b.name}
                  </Link>{" "}
                  <span className="text-muted">{fmtDate(b.next)}</span>
                </div>
              ))}
            </div>
          )}

          {(meetingsRes.data || []).length > 0 && (
            <div className="card">
              <div className="text-xs uppercase tracking-wide text-muted mb-3">Upcoming meetings</div>
              {(meetingsRes.data as any[]).map((m) => (
                <div key={m.id} className="text-sm">
                  <span className="text-teal">{fmtDateTime(m.starts_at)}</span>{" "}
                  <span>{m.summary || "(no title)"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
