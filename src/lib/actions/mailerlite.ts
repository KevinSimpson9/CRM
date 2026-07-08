"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ensureGroup,
  listAllSubscribers,
  listGroups,
  listGroupSubscribers,
  upsertSubscriberToGroup,
} from "@/lib/mailerlite";
import { resolveSegment, type SegmentSpec } from "@/lib/segments";

async function requireUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
}

// Pull subscribers + group membership from MailerLite and match to contacts by email.
export async function runMailerLiteSync() {
  await requireUser();
  const admin = createAdminClient();

  const [groups, allSubs] = await Promise.all([listGroups(), listAllSubscribers()]);

  const subGroups = new Map<string, string[]>(); // subscriber email → group names
  for (const g of groups) {
    const members = await listGroupSubscribers(g.id);
    for (const m of members) {
      const key = m.email.toLowerCase();
      subGroups.set(key, [...(subGroups.get(key) || []), g.name]);
    }
  }

  const { data: contacts } = await admin.from("contacts").select("id, emails").neq("emails", "{}");
  const emailToContact = new Map<string, string>();
  for (const c of (contacts as any[]) || []) {
    for (const e of c.emails) emailToContact.set(e.toLowerCase().trim(), c.id);
  }

  let matched = 0;
  for (const s of allSubs) {
    const contactId = emailToContact.get(s.email.toLowerCase());
    if (!contactId) continue;
    await admin.from("mailerlite_sync").upsert({
      contact_id: contactId,
      mailerlite_subscriber_id: String(s.id),
      subscription_status: s.status,
      groups: subGroups.get(s.email.toLowerCase()) || [],
      last_synced_at: new Date().toISOString(),
    });
    matched++;
  }

  await admin
    .from("sync_state")
    .upsert({ key: "mailerlite", last_synced_at: new Date().toISOString() });
  revalidatePath("/settings");
  return { subscribers: allSubs.length, matched, groups: groups.length };
}

// Push a contact segment into a MailerLite group (created if missing).
export async function pushSegmentToMailerLite(formData: FormData) {
  await requireUser();
  const admin = createAdminClient();

  const kind = formData.get("kind") as SegmentSpec["kind"];
  const value = ((formData.get("value") as string) || "").trim();
  const groupName = ((formData.get("group_name") as string) || "").trim();
  if (!kind || !value || !groupName) throw new Error("Segment, value and group name are required.");

  const contacts = await resolveSegment(admin, { kind, value } as SegmentSpec);
  const withEmail = contacts.filter((c) => c.email);
  const group = await ensureGroup(groupName);

  let pushed = 0;
  for (const c of withEmail) {
    const sub = await upsertSubscriberToGroup(c.email!, c.name, group.id);
    await admin.from("mailerlite_sync").upsert({
      contact_id: c.id,
      mailerlite_subscriber_id: String(sub.id),
      subscription_status: sub.status,
      groups: [groupName],
      last_synced_at: new Date().toISOString(),
    });
    pushed++;
  }

  revalidatePath("/settings");
  return {
    group: group.name,
    pushed,
    skippedNoEmail: contacts.length - withEmail.length,
  };
}
