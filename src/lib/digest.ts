import type { SupabaseClient } from "@supabase/supabase-js";

interface DigestItem {
  when: string;
  text: string;
}

interface DigestSection {
  title: string;
  items: DigestItem[];
}

const PT = "America/Los_Angeles";

function fmtPT(d: string | Date) {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: PT,
  });
}

export async function buildDigest(supabase: SupabaseClient): Promise<{
  subject: string;
  html: string;
  text: string;
  isEmpty: boolean;
}> {
  const now = new Date();
  const startOfTodayPT = new Date(
    new Date().toLocaleString("en-US", { timeZone: PT }).split(",")[0] + " 00:00:00"
  );
  const endOfToday = new Date(now.getTime() + 86400000);
  const in14d = new Date(now.getTime() + 14 * 86400000);

  const [remRes, birthdayRes] = await Promise.all([
    supabase
      .from("reminders")
      .select("*, contacts(name), deals(name)")
      .eq("status", "pending")
      .lte("due_at", in14d.toISOString())
      .order("due_at"),
    supabase.from("contacts").select("id, name, birthday").not("birthday", "is", null),
  ]);

  const reminders = (remRes.data as any[]) || [];
  const label = (r: any) =>
    [r.title, r.contacts?.name, r.deals?.name ? `(${r.deals.name})` : null]
      .filter(Boolean)
      .join(" — ");

  const overdue = reminders.filter((r) => new Date(r.due_at) < now && r.type !== "deal_deadline");
  const dueToday = reminders.filter(
    (r) =>
      new Date(r.due_at) >= now && new Date(r.due_at) <= endOfToday && r.type !== "deal_deadline"
  );
  const dealDeadlines = reminders.filter((r) => r.type === "deal_deadline");

  const birthdays = ((birthdayRes.data as any[]) || [])
    .map((c) => {
      const bd = new Date(c.birthday + "T12:00:00");
      const next = new Date(startOfTodayPT.getFullYear(), bd.getMonth(), bd.getDate(), 12);
      if (next < startOfTodayPT) next.setFullYear(next.getFullYear() + 1);
      return { ...c, next };
    })
    .filter((c) => c.next.getTime() - startOfTodayPT.getTime() < 7 * 86400000)
    .sort((a, b) => a.next.getTime() - b.next.getTime());

  const sections: DigestSection[] = [
    {
      title: `🔴 Overdue (${overdue.length})`,
      items: overdue.map((r) => ({ when: fmtPT(r.due_at), text: label(r) })),
    },
    {
      title: `📌 Due today (${dueToday.length})`,
      items: dueToday.map((r) => ({ when: fmtPT(r.due_at), text: label(r) })),
    },
    {
      title: `💰 Deal deadlines — next 14 days (${dealDeadlines.length})`,
      items: dealDeadlines.map((r) => ({ when: fmtPT(r.due_at), text: label(r) })),
    },
    {
      title: `🎂 Birthdays — next 7 days (${birthdays.length})`,
      items: birthdays.map((b) => ({ when: fmtPT(b.next), text: b.name })),
    },
  ];

  const nonEmpty = sections.filter((s) => s.items.length > 0);
  const isEmpty = nonEmpty.length === 0;
  const appUrl = process.env.APP_URL || "";

  const text = nonEmpty
    .map((s) => `${s.title}\n${s.items.map((i) => `  • ${i.when} — ${i.text}`).join("\n")}`)
    .join("\n\n");

  const html = `
  <div style="font-family:Inter,-apple-system,sans-serif;background:#0a0a0b;color:#e7e7ea;padding:24px;border-radius:12px;max-width:640px">
    <h2 style="margin:0 0 4px;color:#e7e7ea">AK Capital — Morning Digest</h2>
    <p style="margin:0 0 16px;color:#8b8b94;font-size:13px">${now.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      timeZone: PT,
    })}</p>
    ${
      isEmpty
        ? `<p style="color:#8b8b94">Nothing due. Clear runway today.</p>`
        : nonEmpty
            .map(
              (s) => `
      <h3 style="margin:16px 0 6px;font-size:14px;color:#2dd4bf">${s.title}</h3>
      <ul style="margin:0;padding-left:18px;color:#e7e7ea;font-size:14px;line-height:1.7">
        ${s.items
          .map(
            (i) =>
              `<li><span style="color:#d4a94e">${i.when}</span> — ${escapeHtml(i.text)}</li>`
          )
          .join("")}
      </ul>`
            )
            .join("")
    }
    ${
      appUrl
        ? `<p style="margin-top:20px"><a href="${appUrl}/reminders" style="color:#2dd4bf">Open reminders →</a></p>`
        : ""
    }
  </div>`;

  const subject = isEmpty
    ? "CRM digest: nothing due today"
    : `CRM digest: ${overdue.length} overdue · ${dueToday.length} today · ${dealDeadlines.length} deal deadlines`;

  return { subject, html, text: text || "Nothing due today.", isEmpty };
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
