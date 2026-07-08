import type { SupabaseClient } from "@supabase/supabase-js";

export type SegmentSpec =
  | { kind: "stage"; value: string }
  | { kind: "tag"; value: string }
  | { kind: "relationship"; value: string }
  | { kind: "deal"; value: string } // deal id — all participants
  | { kind: "deal_nda"; value: string }; // deal id — participants with NDA signed

export interface SegmentContact {
  id: string;
  name: string;
  email: string | null;
}

export async function resolveSegment(
  db: SupabaseClient,
  spec: SegmentSpec
): Promise<SegmentContact[]> {
  let contactIds: string[] | null = null;

  if (spec.kind === "stage") {
    const { data } = await db
      .from("investor_profiles")
      .select("contact_id")
      .eq("pipeline_stage", spec.value);
    contactIds = (data || []).map((r: any) => r.contact_id);
  } else if (spec.kind === "deal" || spec.kind === "deal_nda") {
    const { data } = await db
      .from("deal_participations")
      .select("contact_id")
      .eq("deal_id", spec.value);
    contactIds = [...new Set((data || []).map((r: any) => r.contact_id as string))];
    if (spec.kind === "deal_nda" && contactIds.length > 0) {
      const { data: profiles } = await db
        .from("investor_profiles")
        .select("contact_id")
        .in("contact_id", contactIds)
        .not("nda_signed_date", "is", null);
      contactIds = (profiles || []).map((r: any) => r.contact_id);
    }
  }

  let query = db.from("contacts").select("id, name, emails");
  if (contactIds !== null) {
    if (contactIds.length === 0) return [];
    query = query.in("id", contactIds);
  } else if (spec.kind === "tag") {
    query = query.contains("tags", [spec.value]);
  } else if (spec.kind === "relationship") {
    query = query.eq("relationship_type", spec.value);
  }

  const { data } = await query;
  return ((data as any[]) || []).map((c) => ({
    id: c.id,
    name: c.name,
    email: c.emails?.[0]?.toLowerCase() || null,
  }));
}
