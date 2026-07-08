import type { SupabaseClient } from "@supabase/supabase-js";
import { getAccessToken, gFetch } from "@/lib/google";

// Map of lowercase email → contact id, from the contacts table.
async function knownEmailMap(admin: SupabaseClient): Promise<Map<string, string>> {
  const { data } = await admin.from("contacts").select("id, emails").neq("emails", "{}");
  const map = new Map<string, string>();
  for (const c of (data as { id: string; emails: string[] }[]) || []) {
    for (const e of c.emails) map.set(e.toLowerCase().trim(), c.id);
  }
  return map;
}

function extractEmails(header: string | undefined): string[] {
  if (!header) return [];
  return (header.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) || []).map((e) => e.toLowerCase());
}

async function getSyncCursor(admin: SupabaseClient, key: string, defaultDaysBack: number) {
  const { data } = await admin.from("sync_state").select("*").eq("key", key).maybeSingle();
  return data?.last_synced_at
    ? new Date(data.last_synced_at)
    : new Date(Date.now() - defaultDaysBack * 86400000);
}

async function setSyncCursor(admin: SupabaseClient, key: string) {
  await admin
    .from("sync_state")
    .upsert({ key, last_synced_at: new Date().toISOString() });
}

// ---------------------------------------------------------------------------
// Gmail: only messages to/from known contact emails are ever stored.
// Dedupe: external_id = `${gmailMessageId}:${contactId}` under source 'gmail'.
// ---------------------------------------------------------------------------
export async function syncGmail(admin: SupabaseClient) {
  const token = await getAccessToken(admin);
  const emailMap = await knownEmailMap(admin);
  if (emailMap.size === 0) return { synced: 0, note: "no contact emails to match" };

  const since = await getSyncCursor(admin, "gmail", 30);
  const afterEpoch = Math.floor(since.getTime() / 1000) - 3600; // 1h overlap for safety
  const emails = [...emailMap.keys()];

  // Gmail search queries have a length limit — chunk the address list.
  const messageIds = new Set<string>();
  for (let i = 0; i < emails.length; i += 15) {
    const chunk = emails.slice(i, i + 15);
    const q = `(${chunk.map((e) => `from:${e} OR to:${e}`).join(" OR ")}) after:${afterEpoch}`;
    let pageToken: string | undefined;
    let pages = 0;
    do {
      const url =
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=100&q=${encodeURIComponent(q)}` +
        (pageToken ? `&pageToken=${pageToken}` : "");
      const json = await gFetch(token, url);
      for (const m of json.messages || []) messageIds.add(m.id);
      pageToken = json.nextPageToken;
      pages++;
    } while (pageToken && pages < 5);
  }

  let synced = 0;
  // Cap per run to stay well inside serverless time limits; the next run catches up.
  const ids = [...messageIds].slice(0, 300);
  for (const id of ids) {
    const msg = await gFetch(
      token,
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Subject`
    );
    const headers: Record<string, string> = {};
    for (const h of msg.payload?.headers || []) headers[h.name.toLowerCase()] = h.value;

    const fromEmails = extractEmails(headers["from"]);
    const toEmails = [...extractEmails(headers["to"]), ...extractEmails(headers["cc"])];
    const inboundContact = fromEmails.map((e) => emailMap.get(e)).find(Boolean);
    const matched = new Map<string, "inbound" | "outbound">();
    if (inboundContact) matched.set(inboundContact, "inbound");
    for (const e of toEmails) {
      const cid = emailMap.get(e);
      if (cid && !matched.has(cid)) matched.set(cid, "outbound");
    }
    if (matched.size === 0) continue;

    const occurredAt = new Date(parseInt(msg.internalDate, 10)).toISOString();
    const rows = [...matched.entries()].map(([contactId, direction]) => ({
      contact_id: contactId,
      channel: "email",
      direction,
      occurred_at: occurredAt,
      subject: headers["subject"] || null,
      body: msg.snippet || null,
      external_id: `${id}:${contactId}`,
      source: "gmail",
    }));
    const { error } = await admin
      .from("interactions")
      .upsert(rows, { onConflict: "source,external_id", ignoreDuplicates: true });
    if (!error) synced += rows.length;
  }

  await setSyncCursor(admin, "gmail");
  return { synced, scanned: ids.length };
}

// ---------------------------------------------------------------------------
// Calendar: past events with known contacts → meeting interactions;
// upcoming events (14 days) with known contacts → calendar_events for dashboard.
// ---------------------------------------------------------------------------
export async function syncCalendar(admin: SupabaseClient) {
  const token = await getAccessToken(admin);
  const emailMap = await knownEmailMap(admin);
  const since = await getSyncCursor(admin, "gcal", 30);
  const now = new Date();
  const timeMin = new Date(since.getTime() - 86400000).toISOString();
  const timeMax = new Date(now.getTime() + 14 * 86400000).toISOString();

  let pageToken: string | undefined;
  let loggedPast = 0;
  let upcoming = 0;
  do {
    const url =
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&maxResults=250` +
      `&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}` +
      (pageToken ? `&pageToken=${pageToken}` : "");
    const json = await gFetch(token, url);

    for (const ev of json.items || []) {
      if (ev.status === "cancelled") continue;
      const attendees: { email?: string; displayName?: string }[] = ev.attendees || [];
      const matchedIds = [
        ...new Set(
          attendees
            .map((a) => a.email && emailMap.get(a.email.toLowerCase()))
            .filter((x): x is string => !!x)
        ),
      ];
      if (matchedIds.length === 0) continue;

      const start = new Date(ev.start?.dateTime || (ev.start?.date ? ev.start.date + "T12:00:00" : 0));
      const end = new Date(ev.end?.dateTime || ev.end?.date || start);

      if (end < now) {
        const rows = matchedIds.map((contactId) => ({
          contact_id: contactId,
          channel: "meeting",
          direction: "outbound",
          occurred_at: start.toISOString(),
          subject: ev.summary || "Meeting",
          body: ev.description?.slice(0, 500) || null,
          external_id: `${ev.id}:${contactId}`,
          source: "gcal",
        }));
        const { error } = await admin
          .from("interactions")
          .upsert(rows, { onConflict: "source,external_id", ignoreDuplicates: true });
        if (!error) loggedPast += rows.length;
      } else {
        await admin.from("calendar_events").upsert({
          id: ev.id,
          summary: ev.summary || null,
          starts_at: start.toISOString(),
          ends_at: end.toISOString(),
          attendees: attendees.map((a) => ({ email: a.email, name: a.displayName })),
          contact_ids: matchedIds,
        });
        upcoming++;
      }
    }
    pageToken = json.nextPageToken;
  } while (pageToken);

  // Drop stale cached events that have already started.
  await admin.from("calendar_events").delete().lt("starts_at", now.toISOString());

  await setSyncCursor(admin, "gcal");
  return { loggedPast, upcoming };
}

// ---------------------------------------------------------------------------
// Google Contacts: one-way import on demand. Never writes back to Google.
// ---------------------------------------------------------------------------
export async function importGoogleContacts(admin: SupabaseClient) {
  const token = await getAccessToken(admin);
  const emailMap = await knownEmailMap(admin);
  const { data: existing } = await admin.from("contacts").select("name");
  const existingNames = new Set(
    ((existing as { name: string }[]) || []).map((c) => c.name.toLowerCase())
  );

  let pageToken: string | undefined;
  let imported = 0;
  let skipped = 0;
  do {
    const url =
      `https://people.googleapis.com/v1/people/me/connections?pageSize=200` +
      `&personFields=names,emailAddresses,phoneNumbers,organizations,birthdays` +
      (pageToken ? `&pageToken=${pageToken}` : "");
    const json = await gFetch(token, url);

    const rows = [];
    for (const p of json.connections || []) {
      const name = p.names?.[0]?.displayName?.trim();
      if (!name) continue;
      const emails: string[] = (p.emailAddresses || [])
        .map((e: any) => e.value?.toLowerCase().trim())
        .filter(Boolean);
      const alreadyByEmail = emails.some((e) => emailMap.has(e));
      const alreadyByName = emails.length === 0 && existingNames.has(name.toLowerCase());
      if (alreadyByEmail || alreadyByName) {
        skipped++;
        continue;
      }
      const bd = p.birthdays?.[0]?.date;
      rows.push({
        name,
        emails,
        phones: (p.phoneNumbers || []).map((ph: any) => ph.value).filter(Boolean),
        company: p.organizations?.[0]?.name || null,
        title: p.organizations?.[0]?.title || null,
        birthday:
          bd?.year && bd?.month && bd?.day
            ? `${bd.year}-${String(bd.month).padStart(2, "0")}-${String(bd.day).padStart(2, "0")}`
            : null,
        relationship_type: "personal",
        source: "google_contacts",
      });
      for (const e of emails) emailMap.set(e, "pending");
      existingNames.add(name.toLowerCase());
    }
    if (rows.length > 0) {
      const { error } = await admin.from("contacts").insert(rows);
      if (error) throw new Error(error.message);
      imported += rows.length;
    }
    pageToken = json.nextPageToken;
  } while (pageToken);

  return { imported, skipped };
}
