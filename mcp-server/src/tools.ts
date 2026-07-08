import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

function db(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the MCP server env.");
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function ok(data: unknown) {
  return {
    content: [
      { type: "text" as const, text: typeof data === "string" ? data : JSON.stringify(data, null, 2) },
    ],
  };
}

function fail(message: string) {
  return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
}

async function findDeal(supabase: SupabaseClient, nameOrId: string) {
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRe.test(nameOrId)) {
    const { data } = await supabase.from("deals").select("*").eq("id", nameOrId).maybeSingle();
    return data;
  }
  const { data } = await supabase.from("deals").select("*").ilike("name", `%${nameOrId}%`).limit(2);
  if (!data || data.length === 0) return null;
  return data[0];
}

const CHANNELS = [
  "email", "call", "meeting", "text", "imessage", "whatsapp",
  "linkedin", "instagram", "in_person", "other",
] as const;

const STAGES = ["lead", "contacted", "nda", "soft_commit", "docs_sent", "funded", "passed"] as const;

export function registerTools(server: McpServer) {
  server.tool(
    "search_contacts",
    "Fuzzy-search contacts by name, company, email, title or tag. Returns id, name, company, relationship type, emails, tags, pipeline stage if any.",
    { query: z.string().describe("Search text, e.g. a name or company") },
    async ({ query }) => {
      const supabase = db();
      const { data, error } = await supabase.rpc("search_contacts", { q: query });
      if (error) return fail(error.message);
      const ids = (data || []).map((c: any) => c.id);
      const { data: profiles } = ids.length
        ? await supabase.from("investor_profiles").select("contact_id, pipeline_stage").in("contact_id", ids)
        : { data: [] as any[] };
      const stageMap = new Map((profiles || []).map((p: any) => [p.contact_id, p.pipeline_stage]));
      return ok(
        (data || []).map((c: any) => ({
          id: c.id,
          name: c.name,
          company: c.company,
          title: c.title,
          relationship_type: c.relationship_type,
          emails: c.emails,
          tags: c.tags,
          pipeline_stage: stageMap.get(c.id) || null,
        }))
      );
    }
  );

  server.tool(
    "get_contact",
    "Get a contact's full record plus investor profile, deal participations, open reminders and recent interaction timeline.",
    {
      contact_id: z.string().describe("Contact UUID (from search_contacts)"),
      timeline_limit: z.number().int().min(1).max(100).default(25),
    },
    async ({ contact_id, timeline_limit }) => {
      const supabase = db();
      const [contact, profile, parts, interactions, reminders, ml] = await Promise.all([
        supabase.from("contacts").select("*").eq("id", contact_id).maybeSingle(),
        supabase.from("investor_profiles").select("*").eq("contact_id", contact_id).maybeSingle(),
        supabase.from("deal_participations").select("*, deals(name, status)").eq("contact_id", contact_id),
        supabase
          .from("interactions")
          .select("channel, direction, occurred_at, subject, body, source")
          .eq("contact_id", contact_id)
          .order("occurred_at", { ascending: false })
          .limit(timeline_limit),
        supabase.from("reminders").select("type, title, due_at, status").eq("contact_id", contact_id).eq("status", "pending"),
        supabase.from("mailerlite_sync").select("subscription_status, groups").eq("contact_id", contact_id).maybeSingle(),
      ]);
      if (!contact.data) return fail("Contact not found.");
      return ok({
        contact: contact.data,
        investor_profile: profile.data,
        deal_participations: parts.data,
        open_reminders: reminders.data,
        mailerlite: ml.data,
        timeline: interactions.data,
      });
    }
  );

  server.tool(
    "create_contact",
    "Create a new contact.",
    {
      name: z.string(),
      emails: z.array(z.string()).default([]),
      phones: z.array(z.string()).default([]),
      company: z.string().optional(),
      title: z.string().optional(),
      location: z.string().optional(),
      relationship_type: z
        .enum(["investor", "lender", "partner", "vendor", "personal", "prospect"])
        .default("prospect"),
      source: z.string().optional().describe("Where they came from, e.g. 'Delta Pilot Watch Club'"),
      tags: z.array(z.string()).default([]),
      notes: z.string().optional(),
      keep_in_touch_days: z.number().int().optional().describe("Cadence in days, e.g. 30/60/90"),
    },
    async (args) => {
      const supabase = db();
      const { data, error } = await supabase.from("contacts").insert(args).select("id, name").single();
      if (error) return fail(error.message);
      return ok({ created: data });
    }
  );

  server.tool(
    "log_interaction",
    "Log an interaction on a contact's timeline (also resets their keep-in-touch clock).",
    {
      contact_id: z.string(),
      channel: z.enum(CHANNELS).default("other"),
      direction: z.enum(["inbound", "outbound"]).default("outbound"),
      subject: z.string().optional(),
      body: z.string().describe("What happened / summary"),
      occurred_at: z.string().optional().describe("ISO timestamp; defaults to now"),
    },
    async (args) => {
      const supabase = db();
      const { error } = await supabase.from("interactions").insert({
        ...args,
        occurred_at: args.occurred_at || new Date().toISOString(),
        source: "manual",
      });
      if (error) return fail(error.message);
      return ok({ logged: true });
    }
  );

  server.tool(
    "create_reminder",
    "Create a follow-up or date-based reminder, optionally linked to a contact.",
    {
      title: z.string(),
      due_at: z.string().describe("ISO date or datetime, e.g. 2026-07-15"),
      contact_id: z.string().optional(),
      type: z.enum(["follow_up", "date_based"]).default("follow_up"),
    },
    async ({ title, due_at, contact_id, type }) => {
      const supabase = db();
      const due = due_at.length === 10 ? `${due_at}T17:00:00Z` : due_at;
      const { error } = await supabase.from("reminders").insert({
        title,
        due_at: new Date(due).toISOString(),
        contact_id: contact_id || null,
        type,
      });
      if (error) return fail(error.message);
      return ok({ created: true, due_at: due });
    }
  );

  server.tool(
    "list_due_followups",
    "List pending reminders that are due (or due soon). Optionally filter to contacts participating in a specific deal — e.g. 'who is overdue in the Avenue pipeline'.",
    {
      within_days: z.number().int().default(0).describe("0 = due now/overdue; 7 = also next 7 days"),
      deal: z.string().optional().describe("Deal name (fuzzy) or id to filter by participation"),
    },
    async ({ within_days, deal }) => {
      const supabase = db();
      const cutoff = new Date(Date.now() + within_days * 86400000).toISOString();
      let query = supabase
        .from("reminders")
        .select("id, type, title, due_at, contact_id, contacts(name, company), deals(name)")
        .eq("status", "pending")
        .lte("due_at", cutoff)
        .order("due_at");

      if (deal) {
        const d = await findDeal(supabase, deal);
        if (!d) return fail(`No deal matching "${deal}".`);
        const { data: parts } = await supabase
          .from("deal_participations")
          .select("contact_id")
          .eq("deal_id", d.id);
        const ids = [...new Set((parts || []).map((p: any) => p.contact_id))];
        if (ids.length === 0) return ok({ deal: d.name, due: [] });
        query = query.in("contact_id", ids);
      }

      const { data, error } = await query;
      if (error) return fail(error.message);
      const now = new Date();
      return ok(
        (data || []).map((r: any) => ({
          reminder_id: r.id,
          type: r.type,
          title: r.title,
          due_at: r.due_at,
          overdue: new Date(r.due_at) < now,
          contact_id: r.contact_id,
          contact: r.contacts?.name,
          company: r.contacts?.company,
          deal: r.deals?.name,
        }))
      );
    }
  );

  server.tool(
    "update_pipeline_stage",
    "Move an investor to a pipeline stage (creates the investor profile if missing). Stage history is recorded automatically.",
    { contact_id: z.string(), stage: z.enum(STAGES) },
    async ({ contact_id, stage }) => {
      const supabase = db();
      const { error } = await supabase
        .from("investor_profiles")
        .upsert({ contact_id, pipeline_stage: stage });
      if (error) return fail(error.message);
      return ok({ contact_id, stage });
    }
  );

  server.tool(
    "link_contact_to_deal",
    "Add (or update) a contact's participation in a deal with role, amount, rate and key dates.",
    {
      contact_id: z.string(),
      deal: z.string().describe("Deal name (fuzzy) or id"),
      role: z.enum(["lender", "lp", "guarantor", "co_developer", "prospect"]).default("prospect"),
      amount: z.number().optional(),
      rate: z.number().optional().describe("Annual rate %, for notes"),
      key_dates: z
        .array(z.object({ label: z.string(), date: z.string() }))
        .default([])
        .describe("e.g. [{label: 'First interest installment', date: '2026-09-01'}]"),
      notes: z.string().optional(),
    },
    async ({ contact_id, deal, role, amount, rate, key_dates, notes }) => {
      const supabase = db();
      const d = await findDeal(supabase, deal);
      if (!d) return fail(`No deal matching "${deal}".`);
      const { data: existing } = await supabase
        .from("deal_participations")
        .select("id")
        .eq("contact_id", contact_id)
        .eq("deal_id", d.id)
        .maybeSingle();
      const row = { contact_id, deal_id: d.id, role, amount, rate, key_dates, notes };
      const { error } = existing
        ? await supabase.from("deal_participations").update(row).eq("id", existing.id)
        : await supabase.from("deal_participations").insert(row);
      if (error) return fail(error.message);
      return ok({ deal: d.name, contact_id, role, updated_existing: !!existing });
    }
  );

  server.tool(
    "get_deal_summary",
    "Summary of a deal: status, raise progress, and every participant with terms, key dates and pipeline stage.",
    { deal: z.string().describe("Deal name (fuzzy) or id") },
    async ({ deal }) => {
      const supabase = db();
      const d = await findDeal(supabase, deal);
      if (!d) return fail(`No deal matching "${deal}".`);
      const { data: parts } = await supabase
        .from("deal_participations")
        .select("role, amount, rate, key_dates, notes, contact_id, contacts(name, company, emails)")
        .eq("deal_id", d.id);
      const ids = (parts || []).map((p: any) => p.contact_id);
      const { data: profiles } = ids.length
        ? await supabase.from("investor_profiles").select("contact_id, pipeline_stage, nda_signed_date").in("contact_id", ids)
        : { data: [] as any[] };
      const profMap = new Map((profiles || []).map((p: any) => [p.contact_id, p]));
      const participants = (parts || []).map((p: any) => ({
        contact_id: p.contact_id,
        name: p.contacts?.name,
        company: p.contacts?.company,
        role: p.role,
        amount: p.amount,
        rate: p.rate,
        key_dates: p.key_dates,
        notes: p.notes,
        pipeline_stage: profMap.get(p.contact_id)?.pipeline_stage || null,
        nda_signed: !!profMap.get(p.contact_id)?.nda_signed_date,
      }));
      return ok({
        deal: {
          id: d.id, name: d.name, entity: d.entity, status: d.status,
          target_raise: d.target_raise, raised_to_date: d.raised_to_date,
          structure_notes: d.structure_notes,
        },
        participant_count: participants.length,
        participant_total: participants.reduce((s, p) => s + (Number(p.amount) || 0), 0),
        participants,
      });
    }
  );

  server.tool(
    "push_segment_to_mailerlite",
    "Push a contact segment into a MailerLite group (created if missing). Segments: deal_nda (NDA signers on a deal), deal (all participants), stage (pipeline stage), tag, relationship.",
    {
      kind: z.enum(["deal_nda", "deal", "stage", "tag", "relationship"]),
      value: z.string().describe("Deal name/id, stage key, tag, or relationship type"),
      group_name: z.string().describe("MailerLite group name, e.g. 'Avenue NDA signers'"),
    },
    async ({ kind, value, group_name }) => {
      const apiKey = process.env.MAILERLITE_API_KEY;
      if (!apiKey) return fail("MAILERLITE_API_KEY not set in the MCP server env.");
      const supabase = db();

      let contactIds: string[] | null = null;
      if (kind === "deal" || kind === "deal_nda") {
        const d = await findDeal(supabase, value);
        if (!d) return fail(`No deal matching "${value}".`);
        const { data } = await supabase.from("deal_participations").select("contact_id").eq("deal_id", d.id);
        contactIds = [...new Set((data || []).map((r: any) => r.contact_id as string))];
        if (kind === "deal_nda" && contactIds.length) {
          const { data: profs } = await supabase
            .from("investor_profiles")
            .select("contact_id")
            .in("contact_id", contactIds)
            .not("nda_signed_date", "is", null);
          contactIds = (profs || []).map((r: any) => r.contact_id);
        }
      } else if (kind === "stage") {
        const { data } = await supabase.from("investor_profiles").select("contact_id").eq("pipeline_stage", value);
        contactIds = (data || []).map((r: any) => r.contact_id);
      }

      let cq = supabase.from("contacts").select("id, name, emails");
      if (contactIds !== null) {
        if (contactIds.length === 0) return ok({ pushed: 0, note: "segment is empty" });
        cq = cq.in("id", contactIds);
      } else if (kind === "tag") {
        cq = cq.contains("tags", [value]);
      } else {
        cq = cq.eq("relationship_type", value);
      }
      const { data: contacts } = await cq;
      const withEmail = (contacts || []).filter((c: any) => c.emails?.[0]);

      const mlFetch = async (path: string, init?: RequestInit) => {
        const res = await fetch(`https://connect.mailerlite.com/api${path}`, {
          ...init,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        });
        if (!res.ok) throw new Error(`MailerLite ${res.status}: ${await res.text()}`);
        return res.json();
      };

      const groupsJson = await mlFetch(`/groups?limit=100`);
      let group = (groupsJson.data || []).find(
        (g: any) => g.name.toLowerCase() === group_name.toLowerCase()
      );
      if (!group) {
        group = (await mlFetch(`/groups`, { method: "POST", body: JSON.stringify({ name: group_name }) })).data;
      }

      let pushed = 0;
      for (const c of withEmail) {
        await mlFetch(`/subscribers`, {
          method: "POST",
          body: JSON.stringify({
            email: c.emails[0].toLowerCase(),
            fields: { name: c.name },
            groups: [group.id],
          }),
        });
        pushed++;
      }
      return ok({
        group: group.name,
        pushed,
        skipped_no_email: (contacts || []).length - withEmail.length,
      });
    }
  );

  server.tool(
    "draft_context",
    "Everything known about a contact, formatted as briefing material for drafting outreach in Kevin's voice: profile, investor status, deals and terms, recent touchpoints, open reminders.",
    { contact_id: z.string() },
    async ({ contact_id }) => {
      const supabase = db();
      const [contact, profile, parts, interactions, reminders] = await Promise.all([
        supabase.from("contacts").select("*").eq("id", contact_id).maybeSingle(),
        supabase.from("investor_profiles").select("*").eq("contact_id", contact_id).maybeSingle(),
        supabase.from("deal_participations").select("*, deals(name, status)").eq("contact_id", contact_id),
        supabase
          .from("interactions")
          .select("channel, direction, occurred_at, subject, body")
          .eq("contact_id", contact_id)
          .order("occurred_at", { ascending: false })
          .limit(15),
        supabase.from("reminders").select("title, due_at, type").eq("contact_id", contact_id).eq("status", "pending"),
      ]);
      const c: any = contact.data;
      if (!c) return fail("Contact not found.");
      const p: any = profile.data;

      const lines: string[] = [
        `# ${c.name}`,
        [c.title, c.company].filter(Boolean).join(" @ ") || "",
        `Relationship: ${c.relationship_type}${c.source ? ` (via ${c.source})` : ""}`,
        c.location ? `Location: ${c.location}` : "",
        c.emails?.length ? `Email: ${c.emails.join(", ")}` : "",
        c.tags?.length ? `Tags: ${c.tags.join(", ")}` : "",
        c.keep_in_touch_days ? `Keep-in-touch cadence: every ${c.keep_in_touch_days} days` : "",
        c.notes ? `\n## Notes\n${c.notes}` : "",
      ];
      if (p) {
        lines.push(
          `\n## Investor profile`,
          `Pipeline stage: ${p.pipeline_stage}`,
          `Accreditation: ${p.accreditation_status}${p.accreditation_verified_date ? ` (verified ${p.accreditation_verified_date})` : ""}`,
          p.nda_signed_date ? `NDA signed: ${p.nda_signed_date}` : "NDA: not signed",
          p.ppm_sent_date ? `PPM sent: ${p.ppm_sent_date}` : "",
          p.soft_commit_amount ? `Soft commit: $${Number(p.soft_commit_amount).toLocaleString()}` : "",
          p.funded_amount ? `Funded: $${Number(p.funded_amount).toLocaleString()}` : "",
          p.preferred_structures ? `Prefers: ${p.preferred_structures}` : "",
          p.sdira_or_tsp ? `Uses SDIRA/TSP funds` : ""
        );
      }
      const partRows: any[] = parts.data || [];
      if (partRows.length) {
        lines.push(`\n## Deals`);
        for (const pt of partRows) {
          lines.push(
            `- ${pt.deals?.name} (${pt.deals?.status}): ${pt.role}` +
              (pt.amount ? `, $${Number(pt.amount).toLocaleString()}` : "") +
              (pt.rate ? ` @ ${pt.rate}%` : "") +
              ((pt.key_dates || []).length
                ? ` — key dates: ${(pt.key_dates as any[]).map((k) => `${k.label} ${k.date}`).join("; ")}`
                : "")
          );
        }
      }
      const ints: any[] = interactions.data || [];
      if (ints.length) {
        lines.push(`\n## Recent touchpoints (newest first)`);
        for (const i of ints) {
          lines.push(
            `- ${i.occurred_at.slice(0, 10)} [${i.channel} ${i.direction === "inbound" ? "←" : "→"}] ${
              i.subject || ""
            } ${i.body ? "— " + String(i.body).slice(0, 160) : ""}`.trim()
          );
        }
      }
      const rems: any[] = reminders.data || [];
      if (rems.length) {
        lines.push(`\n## Open reminders`);
        for (const r of rems) lines.push(`- ${r.title} (due ${r.due_at.slice(0, 10)}, ${r.type})`);
      }
      lines.push(
        `\n## Drafting guidance`,
        `Voice: warm, personal, peer-to-peer — operator/pilot who knows things. Direct, no filler, never institutional.`
      );
      return ok(lines.filter(Boolean).join("\n"));
    }
  );

  server.tool(
    "ingest_interaction",
    "Generic inbound adapter: log a message from any external channel (iMessage, WhatsApp, scripts). Matches the contact by email, phone, or exact name; dedupes on external_id.",
    {
      channel: z.enum(CHANNELS),
      direction: z.enum(["inbound", "outbound"]),
      body: z.string(),
      subject: z.string().optional(),
      occurred_at: z.string().optional().describe("ISO timestamp; defaults to now"),
      external_id: z.string().optional().describe("Stable message id for dedupe"),
      contact_email: z.string().optional(),
      contact_phone: z.string().optional(),
      contact_name: z.string().optional(),
      create_if_missing: z.boolean().default(false),
    },
    async (args) => {
      const supabase = db();
      const contactId = await matchContact(supabase, args);
      if (!contactId) {
        return fail(
          "No matching contact (tried email, phone, exact name). Pass create_if_missing=true to create one."
        );
      }
      const row = {
        contact_id: contactId,
        channel: args.channel,
        direction: args.direction,
        subject: args.subject || null,
        body: args.body,
        occurred_at: args.occurred_at || new Date().toISOString(),
        external_id: args.external_id || null,
        source: "mcp_adapter",
      };
      const { error } = args.external_id
        ? await supabase
            .from("interactions")
            .upsert(row, { onConflict: "source,external_id", ignoreDuplicates: true })
        : await supabase.from("interactions").insert(row);
      if (error) return fail(error.message);
      return ok({ logged: true, contact_id: contactId });
    }
  );
}

export async function matchContact(
  supabase: SupabaseClient,
  args: {
    contact_email?: string;
    contact_phone?: string;
    contact_name?: string;
    create_if_missing?: boolean;
  }
): Promise<string | null> {
  if (args.contact_email) {
    const { data } = await supabase
      .from("contacts")
      .select("id")
      .contains("emails", [args.contact_email.toLowerCase().trim()])
      .maybeSingle();
    if (data) return data.id;
  }
  if (args.contact_phone) {
    const digits = args.contact_phone.replace(/\D/g, "");
    const { data } = await supabase.from("contacts").select("id, phones").neq("phones", "{}");
    const hit = (data || []).find((c: any) =>
      c.phones.some((p: string) => p.replace(/\D/g, "").endsWith(digits.slice(-10)))
    );
    if (hit) return hit.id;
  }
  if (args.contact_name) {
    const { data } = await supabase
      .from("contacts")
      .select("id")
      .ilike("name", args.contact_name.trim())
      .maybeSingle();
    if (data) return data.id;
  }
  if (args.create_if_missing && (args.contact_name || args.contact_email || args.contact_phone)) {
    const { data } = await supabase
      .from("contacts")
      .insert({
        name: args.contact_name || args.contact_email || args.contact_phone,
        emails: args.contact_email ? [args.contact_email.toLowerCase().trim()] : [],
        phones: args.contact_phone ? [args.contact_phone] : [],
        relationship_type: "personal",
        source: "channel_adapter",
      })
      .select("id")
      .single();
    return data?.id ?? null;
  }
  return null;
}
