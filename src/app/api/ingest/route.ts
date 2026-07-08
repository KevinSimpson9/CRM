import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestInteraction, type IngestPayload } from "@/lib/ingest";

export const dynamic = "force-dynamic";

const CHANNELS = new Set([
  "email", "call", "meeting", "text", "imessage", "whatsapp",
  "linkedin", "instagram", "in_person", "other",
]);

// Generic inbound adapter: any external MCP bridge or script can log messages.
// Auth: Authorization: Bearer ${INGEST_TOKEN}. Dedupe: external_id.
export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.INGEST_TOKEN || auth !== `Bearer ${process.env.INGEST_TOKEN}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let payload: IngestPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!payload.body || !CHANNELS.has(payload.channel) ||
      !["inbound", "outbound"].includes(payload.direction)) {
    return NextResponse.json(
      { error: "required: channel (valid), direction (inbound|outbound), body" },
      { status: 400 }
    );
  }

  const result = await ingestInteraction(createAdminClient(), payload);
  if (!result.ok) {
    const status = result.error === "no_matching_contact" ? 404 : 500;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ ok: true, contact_id: result.contact_id });
}
