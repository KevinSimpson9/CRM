"use client";

import type { Contact } from "@/lib/types";

const TYPES = ["investor", "prospect", "lender", "partner", "vendor", "personal"];

export default function ContactForm({
  contact,
  action,
}: {
  contact?: Contact;
  action: (formData: FormData) => Promise<void>;
}) {
  const c = contact;
  const importantDatesText = (c?.important_dates || [])
    .map((d) => `${d.label}: ${d.date}`)
    .join("\n");

  return (
    <form action={action} className="card max-w-3xl space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label htmlFor="name">Name *</label>
          <input id="name" name="name" required defaultValue={c?.name} className="w-full" autoFocus />
        </div>
        <div className="space-y-1">
          <label htmlFor="relationship_type">Relationship</label>
          <select
            id="relationship_type"
            name="relationship_type"
            defaultValue={c?.relationship_type || "personal"}
            className="w-full"
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor="emails">Emails (comma-separated)</label>
          <input id="emails" name="emails" defaultValue={c?.emails.join(", ")} className="w-full" />
        </div>
        <div className="space-y-1">
          <label htmlFor="phones">Phones (comma-separated)</label>
          <input id="phones" name="phones" defaultValue={c?.phones.join(", ")} className="w-full" />
        </div>
        <div className="space-y-1">
          <label htmlFor="company">Company</label>
          <input id="company" name="company" defaultValue={c?.company ?? ""} className="w-full" />
        </div>
        <div className="space-y-1">
          <label htmlFor="title">Title</label>
          <input id="title" name="title" defaultValue={c?.title ?? ""} className="w-full" />
        </div>
        <div className="space-y-1">
          <label htmlFor="location">Location</label>
          <input id="location" name="location" defaultValue={c?.location ?? ""} className="w-full" />
        </div>
        <div className="space-y-1">
          <label htmlFor="source">Source</label>
          <input
            id="source"
            name="source"
            placeholder="e.g. Delta Pilot Watch Club, referral"
            defaultValue={c?.source ?? ""}
            className="w-full"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="tags">Tags (comma-separated)</label>
          <input id="tags" name="tags" defaultValue={c?.tags.join(", ")} className="w-full" />
        </div>
        <div className="space-y-1">
          <label htmlFor="birthday">Birthday</label>
          <input id="birthday" name="birthday" type="date" defaultValue={c?.birthday ?? ""} className="w-full" />
        </div>
        <div className="space-y-1">
          <label htmlFor="keep_in_touch_days">Keep in touch every (days)</label>
          <input
            id="keep_in_touch_days"
            name="keep_in_touch_days"
            type="number"
            min={1}
            placeholder="30 / 60 / 90 — blank for none"
            defaultValue={c?.keep_in_touch_days ?? ""}
            className="w-full"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="linkedin_url">LinkedIn URL</label>
          <input id="linkedin_url" name="linkedin_url" defaultValue={c?.linkedin_url ?? ""} className="w-full" />
        </div>
        <div className="space-y-1">
          <label htmlFor="instagram_handle">Instagram handle</label>
          <input
            id="instagram_handle"
            name="instagram_handle"
            defaultValue={c?.instagram_handle ?? ""}
            className="w-full"
          />
        </div>
      </div>
      <div className="space-y-1">
        <label htmlFor="important_dates">Important dates (one per line, “Label: YYYY-MM-DD”)</label>
        <textarea
          id="important_dates"
          name="important_dates"
          rows={2}
          placeholder={"Anniversary: 2020-06-15\nKid graduation: 2026-05-30"}
          defaultValue={importantDatesText}
          className="w-full font-mono text-xs"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="notes">Notes</label>
        <textarea id="notes" name="notes" rows={4} defaultValue={c?.notes ?? ""} className="w-full" />
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn-primary">
          {c ? "Save changes" : "Create contact"}
        </button>
      </div>
    </form>
  );
}
