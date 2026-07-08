"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { splitList } from "@/lib/utils";
import type { ImportantDate } from "@/lib/types";

function parseImportantDates(s: string): ImportantDate[] {
  // one per line: "Label: YYYY-MM-DD"
  return s
    .split("\n")
    .map((line) => {
      const m = line.match(/^(.*?):\s*(\d{4}-\d{2}-\d{2})\s*$/);
      return m ? { label: m[1].trim(), date: m[2] } : null;
    })
    .filter((x): x is ImportantDate => x !== null);
}

function contactFromForm(formData: FormData) {
  const str = (k: string) => ((formData.get(k) as string) || "").trim();
  const kit = str("keep_in_touch_days");
  return {
    name: str("name"),
    emails: splitList(str("emails")),
    phones: splitList(str("phones")),
    company: str("company") || null,
    title: str("title") || null,
    location: str("location") || null,
    relationship_type: str("relationship_type") || "personal",
    source: str("source") || null,
    tags: splitList(str("tags")),
    birthday: str("birthday") || null,
    important_dates: parseImportantDates(str("important_dates")),
    linkedin_url: str("linkedin_url") || null,
    instagram_handle: str("instagram_handle") || null,
    notes: str("notes") || null,
    keep_in_touch_days: kit ? parseInt(kit, 10) : null,
  };
}

export async function createContact(formData: FormData) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("contacts")
    .insert(contactFromForm(formData))
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/contacts");
  redirect(`/contacts/${data.id}`);
}

export async function updateContact(id: string, formData: FormData) {
  const supabase = createClient();
  const { error } = await supabase.from("contacts").update(contactFromForm(formData)).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/contacts/${id}`);
  revalidatePath("/contacts");
  redirect(`/contacts/${id}`);
}

export async function deleteContact(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("contacts").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/contacts");
  redirect("/contacts");
}

export interface ImportRow {
  name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  email2?: string;
  phone?: string;
  phone2?: string;
  company?: string;
  title?: string;
  location?: string;
  relationship_type?: string;
  source?: string;
  tags?: string;
  birthday?: string;
  linkedin_url?: string;
  instagram_handle?: string;
  notes?: string;
}

const VALID_TYPES = ["investor", "lender", "partner", "vendor", "personal", "prospect"];

export async function importContacts(rows: ImportRow[]) {
  const supabase = createClient();
  const mapped = rows
    .map((r) => {
      const name =
        (r.name || `${r.first_name || ""} ${r.last_name || ""}`).trim();
      if (!name) return null;
      const emails = [r.email, r.email2].filter(Boolean).flatMap((e) => splitList(e!));
      const phones = [r.phone, r.phone2].filter(Boolean).flatMap((p) => splitList(p!));
      const rt = (r.relationship_type || "").toLowerCase().trim();
      let birthday: string | null = null;
      if (r.birthday) {
        const d = new Date(r.birthday);
        if (!isNaN(d.getTime())) birthday = d.toISOString().slice(0, 10);
      }
      return {
        name,
        emails,
        phones,
        company: r.company?.trim() || null,
        title: r.title?.trim() || null,
        location: r.location?.trim() || null,
        relationship_type: VALID_TYPES.includes(rt) ? rt : "personal",
        source: r.source?.trim() || "csv_import",
        tags: r.tags ? splitList(r.tags) : [],
        birthday,
        linkedin_url: r.linkedin_url?.trim() || null,
        instagram_handle: r.instagram_handle?.trim() || null,
        notes: r.notes?.trim() || null,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  let inserted = 0;
  const errors: string[] = [];
  for (let i = 0; i < mapped.length; i += 200) {
    const chunk = mapped.slice(i, i + 200);
    const { error, count } = await supabase
      .from("contacts")
      .insert(chunk, { count: "exact" });
    if (error) errors.push(`Rows ${i + 1}–${i + chunk.length}: ${error.message}`);
    else inserted += count ?? chunk.length;
  }
  revalidatePath("/contacts");
  return { inserted, skipped: rows.length - mapped.length, errors };
}
