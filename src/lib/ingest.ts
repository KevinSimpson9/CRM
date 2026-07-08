import type { SupabaseClient } from "@supabase/supabase-js";

export interface IngestPayload {
  channel: string;
  direction: "inbound" | "outbound";
  body: string;
  subject?: string;
  occurred_at?: string;
  external_id?: string;
  contact_email?: string;
  contact_phone?: string;
  contact_name?: string;
  create_if_missing?: boolean;
}

// Match an inbound message to a contact by email, phone suffix, or exact name.
export async function matchContact(
  admin: SupabaseClient,
  p: IngestPayload
): Promise<string | null> {
  if (p.contact_email) {
    const { data } = await admin
      .from("contacts")
      .select("id")
      .contains("emails", [p.contact_email.toLowerCase().trim()])
      .maybeSingle();
    if (data) return data.id;
  }
  if (p.contact_phone) {
    const digits = p.contact_phone.replace(/\D/g, "");
    const { data } = await admin.from("contacts").select("id, phones").neq("phones", "{}");
    const hit = ((data as any[]) || []).find((c) =>
      c.phones.some((ph: string) => ph.replace(/\D/g, "").endsWith(digits.slice(-10)))
    );
    if (hit) return hit.id;
  }
  if (p.contact_name) {
    const { data } = await admin
      .from("contacts")
      .select("id")
      .ilike("name", p.contact_name.trim())
      .limit(2);
    if (data?.length === 1) return data[0].id;
  }
  if (p.create_if_missing && (p.contact_name || p.contact_email || p.contact_phone)) {
    const { data } = await admin
      .from("contacts")
      .insert({
        name: p.contact_name || p.contact_email || p.contact_phone,
        emails: p.contact_email ? [p.contact_email.toLowerCase().trim()] : [],
        phones: p.contact_phone ? [p.contact_phone] : [],
        relationship_type: "personal",
        source: "channel_adapter",
      })
      .select("id")
      .single();
    return data?.id ?? null;
  }
  return null;
}

export async function ingestInteraction(admin: SupabaseClient, p: IngestPayload) {
  const contactId = await matchContact(admin, p);
  if (!contactId) {
    return { ok: false as const, error: "no_matching_contact" };
  }
  const row = {
    contact_id: contactId,
    channel: p.channel,
    direction: p.direction,
    subject: p.subject || null,
    body: p.body,
    occurred_at: p.occurred_at || new Date().toISOString(),
    external_id: p.external_id || null,
    source: "mcp_adapter",
  };
  const { error } = p.external_id
    ? await admin
        .from("interactions")
        .upsert(row, { onConflict: "source,external_id", ignoreDuplicates: true })
    : await admin.from("interactions").insert(row);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, contact_id: contactId };
}
