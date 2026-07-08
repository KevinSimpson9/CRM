// MailerLite "new" API (connect.mailerlite.com). Free tier: 1,000 subscribers,
// 12,000 emails/month. Plain fetch, no SDK.

const BASE = "https://connect.mailerlite.com/api";

async function ml<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.MAILERLITE_API_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`MailerLite ${res.status} ${path}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export interface MLSubscriber {
  id: string;
  email: string;
  status: string;
}

export interface MLGroup {
  id: string;
  name: string;
}

export async function listGroups(): Promise<MLGroup[]> {
  const out: MLGroup[] = [];
  let page = 1;
  for (;;) {
    const json = await ml(`/groups?limit=100&page=${page}`);
    out.push(...(json.data || []));
    if (!json.links?.next || (json.data || []).length === 0) break;
    page++;
    if (page > 20) break;
  }
  return out;
}

export async function ensureGroup(name: string): Promise<MLGroup> {
  const groups = await listGroups();
  const existing = groups.find((g) => g.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing;
  const json = await ml(`/groups`, { method: "POST", body: JSON.stringify({ name }) });
  return json.data;
}

export async function listAllSubscribers(): Promise<MLSubscriber[]> {
  const out: MLSubscriber[] = [];
  let cursor: string | null = null;
  for (let i = 0; i < 20; i++) {
    const json: any = await ml(`/subscribers?limit=100${cursor ? `&cursor=${cursor}` : ""}`);
    out.push(...(json.data || []));
    cursor = json.meta?.next_cursor || null;
    if (!cursor) break;
  }
  return out;
}

export async function listGroupSubscribers(groupId: string): Promise<MLSubscriber[]> {
  const out: MLSubscriber[] = [];
  let cursor: string | null = null;
  for (let i = 0; i < 20; i++) {
    const json: any = await ml(
      `/groups/${groupId}/subscribers?limit=100${cursor ? `&cursor=${cursor}` : ""}`
    );
    out.push(...(json.data || []));
    cursor = json.meta?.next_cursor || null;
    if (!cursor) break;
  }
  return out;
}

// Create-or-update a subscriber and attach them to a group.
export async function upsertSubscriberToGroup(
  email: string,
  name: string | null,
  groupId: string
): Promise<MLSubscriber> {
  const json = await ml(`/subscribers`, {
    method: "POST",
    body: JSON.stringify({
      email,
      ...(name ? { fields: { name } } : {}),
      groups: [groupId],
    }),
  });
  return json.data;
}
