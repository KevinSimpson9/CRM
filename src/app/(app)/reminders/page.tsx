import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ContactSelect from "@/components/ContactSelect";
import {
  completeReminder,
  createReminder,
  deleteReminder,
  snoozeReminder,
} from "@/lib/actions/reminders";
import { fmtDate, relTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  keep_in_touch: "keep in touch",
  follow_up: "follow-up",
  date_based: "date",
  deal_deadline: "deal deadline",
};

function ReminderRow({ r }: { r: any }) {
  const overdue = new Date(r.due_at) < new Date();
  return (
    <div className="flex flex-wrap items-center gap-2 py-2 border-t border-edge text-sm">
      <span className={overdue ? "text-gold w-24" : "text-teal w-24"}>{relTime(r.due_at)}</span>
      <span className="chip">{TYPE_LABEL[r.type] || r.type}</span>
      <span className="font-medium">{r.title}</span>
      {r.contacts && (
        <Link href={`/contacts/${r.contact_id}`} className="text-teal hover:underline">
          {r.contacts.name}
        </Link>
      )}
      {r.deals && <span className="text-muted">· {r.deals.name}</span>}
      <span className="text-xs text-muted">{fmtDate(r.due_at)}</span>
      <div className="ml-auto flex items-center gap-1.5">
        <form action={completeReminder.bind(null, r.id)}>
          <button className="btn text-xs py-0.5">Done</button>
        </form>
        <form action={snoozeReminder.bind(null, r.id, 1)}>
          <button className="chip hover:text-ink" title="Snooze 1 day">+1d</button>
        </form>
        <form action={snoozeReminder.bind(null, r.id, 7)}>
          <button className="chip hover:text-ink" title="Snooze 1 week">+7d</button>
        </form>
        <form action={deleteReminder.bind(null, r.id)}>
          <button className="text-xs text-muted hover:text-red-400" title="Delete">✕</button>
        </form>
      </div>
    </div>
  );
}

export default async function RemindersPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("reminders")
    .select("*, contacts(name), deals(name)")
    .eq("status", "pending")
    .order("due_at")
    .limit(200);

  const now = new Date();
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  const reminders = (data as any[]) || [];
  const overdue = reminders.filter((r) => new Date(r.due_at) < now);
  const today = reminders.filter(
    (r) => new Date(r.due_at) >= now && new Date(r.due_at) <= endOfToday
  );
  const upcoming = reminders.filter((r) => new Date(r.due_at) > endOfToday);

  return (
    <div className="space-y-4 max-w-4xl">
      <h1 className="text-xl font-semibold">Reminders</h1>

      <details className="card">
        <summary className="cursor-pointer text-sm text-muted hover:text-ink">+ New reminder</summary>
        <form action={createReminder} className="grid grid-cols-2 gap-3 mt-3">
          <div className="space-y-1 col-span-2">
            <label>Title *</label>
            <input name="title" required placeholder="Follow up on Avenue soft commit" className="w-full" />
          </div>
          <div className="space-y-1">
            <label>Contact (optional)</label>
            <ContactSelect />
          </div>
          <div className="space-y-1">
            <label>Due date *</label>
            <input type="date" name="due_date" required className="w-full" />
          </div>
          <div className="space-y-1">
            <label>Type</label>
            <select name="type" className="w-full">
              <option value="follow_up">follow-up</option>
              <option value="date_based">date-based</option>
            </select>
          </div>
          <div className="col-span-2">
            <button className="btn-primary">Create reminder</button>
          </div>
        </form>
      </details>

      {[
        { label: "Overdue", items: overdue, accent: "text-gold" },
        { label: "Today", items: today, accent: "text-teal" },
        { label: "Upcoming", items: upcoming, accent: "text-muted" },
      ].map((section) => (
        <div key={section.label} className="card">
          <div className={`text-xs uppercase tracking-wide mb-1 ${section.accent}`}>
            {section.label} ({section.items.length})
          </div>
          {section.items.length === 0 && <div className="text-sm text-muted py-2">None.</div>}
          {section.items.map((r) => (
            <ReminderRow key={r.id} r={r} />
          ))}
        </div>
      ))}
    </div>
  );
}
