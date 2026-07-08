import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import QuickLog from "@/components/QuickLog";
import Timeline from "@/components/Timeline";
import DeleteButton from "@/components/DeleteButton";
import { deleteContact } from "@/lib/actions/contacts";
import InvestorProfileCard from "@/components/InvestorProfileCard";
import type { Contact, ImportantDate, Interaction, InvestorProfile, Reminder } from "@/lib/types";
import { fmtDate, fmtMoney, relTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ContactPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const [
    { data: contact },
    { data: interactions },
    { data: reminders },
    { data: profile },
    { data: participations },
    { data: mailerlite },
  ] = await Promise.all([
    supabase.from("contacts").select("*").eq("id", params.id).single(),
    supabase
      .from("interactions")
      .select("*")
      .eq("contact_id", params.id)
      .order("occurred_at", { ascending: false })
      .limit(200),
    supabase
      .from("reminders")
      .select("*")
      .eq("contact_id", params.id)
      .neq("status", "done")
      .order("due_at"),
    supabase.from("investor_profiles").select("*").eq("contact_id", params.id).maybeSingle(),
    supabase
      .from("deal_participations")
      .select("*, deals(id, name)")
      .eq("contact_id", params.id),
    supabase.from("mailerlite_sync").select("*").eq("contact_id", params.id).maybeSingle(),
  ]);

  if (!contact) notFound();
  const c = contact as Contact;
  const showInvestor =
    !!profile || ["investor", "prospect", "lender"].includes(c.relationship_type);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{c.name}</h1>
          <div className="text-sm text-muted">
            {[c.title, c.company].filter(Boolean).join(" @ ") || " "}
          </div>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Link href={`/contacts/${c.id}/edit`} className="btn">
            Edit
          </Link>
          <DeleteButton
            action={deleteContact.bind(null, c.id)}
            confirmText={`Delete ${c.name} and their entire timeline?`}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span className={c.relationship_type === "investor" ? "chip-gold" : "chip-teal"}>
          {c.relationship_type}
        </span>
        {c.source && <span className="chip">via {c.source}</span>}
        {c.keep_in_touch_days && <span className="chip">touch every {c.keep_in_touch_days}d</span>}
        {c.tags.map((t) => (
          <span key={t} className="chip">
            {t}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <QuickLog contactId={c.id} />
          <div className="card">
            <div className="text-xs uppercase tracking-wide text-muted mb-3">Timeline</div>
            <Timeline interactions={(interactions as Interaction[]) || []} />
          </div>
        </div>

        <div className="space-y-4">
          {showInvestor && (
            <InvestorProfileCard contactId={c.id} profile={profile as InvestorProfile | null} />
          )}

          {((participations as any[]) || []).length > 0 && (
            <div className="card space-y-2">
              <div className="text-xs uppercase tracking-wide text-muted">Deals</div>
              {(participations as any[]).map((p) => (
                <div key={p.id} className="text-sm">
                  <Link href={`/deals/${p.deals?.id}`} className="text-teal hover:underline">
                    {p.deals?.name}
                  </Link>{" "}
                  <span className="chip">{p.role.replace("_", "-")}</span>
                  {p.amount && <span className="text-gold ml-1">{fmtMoney(Number(p.amount))}</span>}
                  {p.rate != null && <span className="text-muted ml-1">@ {p.rate}%</span>}
                  {((p.key_dates as ImportantDate[]) || []).map((kd, i) => (
                    <div key={i} className="text-xs text-muted ml-1">
                      {kd.label}: {fmtDate(kd.date)}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          <div className="card space-y-2 text-sm">
            <div className="text-xs uppercase tracking-wide text-muted">Details</div>
            {c.emails.map((e) => (
              <div key={e}>
                <a href={`mailto:${e}`} className="text-teal hover:underline break-all">
                  {e}
                </a>
              </div>
            ))}
            {c.phones.map((p) => (
              <div key={p} className="text-muted">
                {p}
              </div>
            ))}
            {c.location && <div className="text-muted">{c.location}</div>}
            {c.linkedin_url && (
              <div>
                <a href={c.linkedin_url} target="_blank" className="text-teal hover:underline">
                  LinkedIn ↗
                </a>
              </div>
            )}
            {c.instagram_handle && <div className="text-muted">IG: {c.instagram_handle}</div>}
            {c.birthday && <div className="text-muted">🎂 {fmtDate(c.birthday)}</div>}
            {c.important_dates.length > 0 && (
              <div className="pt-1 space-y-0.5">
                {c.important_dates.map((d, i) => (
                  <div key={i} className="text-muted">
                    📌 {d.label}: {fmtDate(d.date)}
                  </div>
                ))}
              </div>
            )}
            {c.notes && (
              <div className="pt-2 border-t border-edge whitespace-pre-wrap text-muted">{c.notes}</div>
            )}
          </div>

          {mailerlite && (
            <div className="card space-y-2">
              <div className="text-xs uppercase tracking-wide text-muted">MailerLite</div>
              <div className="flex flex-wrap gap-1.5">
                <span
                  className={
                    (mailerlite as any).subscription_status === "active" ? "chip-teal" : "chip"
                  }
                >
                  {(mailerlite as any).subscription_status || "unknown"}
                </span>
                {((mailerlite as any).groups as string[]).map((g) => (
                  <span key={g} className="chip-gold">
                    {g}
                  </span>
                ))}
              </div>
              <div className="text-xs text-muted">
                Last synced {fmtDate((mailerlite as any).last_synced_at)}
              </div>
            </div>
          )}

          {(reminders as Reminder[])?.length > 0 && (
            <div className="card space-y-2">
              <div className="text-xs uppercase tracking-wide text-muted">Open reminders</div>
              {(reminders as Reminder[]).map((r) => (
                <div key={r.id} className="text-sm flex justify-between gap-2">
                  <span>{r.title}</span>
                  <span
                    className={
                      new Date(r.due_at) < new Date() ? "text-gold" : "text-muted"
                    }
                  >
                    {relTime(r.due_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
